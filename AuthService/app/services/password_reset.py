"""Password recovery state: no plaintext codes or email addresses in Redis."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import time

from fastapi import HTTPException
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.redis import r
from app.services import email_sender
from app.services.challenge_store import update_challenge

log = logging.getLogger(__name__)


def _digest(purpose: str, value: str) -> str:
    return hmac.new(settings.JWT_SECRET_KEY.encode(),
                    ("password-reset:" + purpose + ":" + value).encode(), hashlib.sha256).hexdigest()


def email_identity(email: str) -> str:
    return _digest("email", email.strip().lower())


def _key(email: str) -> str:
    return "password-reset:challenge:" + email_identity(email)


def eligible(user) -> bool:
    # Recovery must not activate accounts or turn institutional/OAuth identities
    # into local password accounts. Platonus passwords stay with Platonus.
    return bool(user and user.is_active and user.email_verified
                and not user.iin and not user.google_id and not user.github_id)


def enforce_limits(*, action: str, email: str, ip: str) -> None:
    """Always fail closed, independently of optional login fail-open settings."""
    request = action == "request"
    window = (settings.PASSWORD_RESET_REQUEST_WINDOW_SECONDS if request
              else settings.PASSWORD_RESET_CONFIRM_WINDOW_SECONDS)
    buckets = [
        ("ip", _digest("ip", ip or "unknown"),
         settings.PASSWORD_RESET_REQUEST_IP_LIMIT if request else settings.PASSWORD_RESET_CONFIRM_IP_LIMIT, window),
        ("email", email_identity(email),
         settings.PASSWORD_RESET_REQUEST_EMAIL_LIMIT if request else settings.PASSWORD_RESET_CONFIRM_EMAIL_LIMIT, window),
    ]
    if request:
        buckets.append(("cooldown", email_identity(email), 1, settings.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS))
    try:
        # Fixed windows, with creation and expiry in one atomic transaction.
        # EXPIRE NX also repairs a pre-existing key without extending its window.
        for scope, identity, limit, duration in buckets:
            key = f"password-reset:limit:{action}:{scope}:{identity}"
            duration = max(1, int(duration))
            with r.pipeline() as pipe:
                pipe.incr(key)
                pipe.expire(key, duration, nx=True)
                pipe.ttl(key)
                current, _, ttl = pipe.execute()
            if int(current) > max(1, int(limit)):
                raise HTTPException(429, "Too many requests", headers={"Retry-After": str(max(1, int(ttl)))})
    except RedisError as exc:
        raise HTTPException(503, "Password recovery temporarily unavailable") from exc


def create_challenge(*, email: str, user) -> tuple[str, str, int]:
    ttl = max(30, min(int(settings.PASSWORD_RESET_TTL_SECONDS), 1800))
    code = f"{secrets.randbelow(1_000_000):06d}"
    nonce = secrets.token_urlsafe(24)
    state = {
        "uid": int(user.id) if eligible(user) else 0,
        "password": _digest("password", user.hashed_password) if eligible(user) else _digest("password", nonce),
        "nonce": nonce,
        "hash": _digest("code", email_identity(email) + ":" + nonce + ":" + code),
        "attempts": 0,
        "exp": int(time.time()) + ttl,
    }
    r.setex(_key(email), ttl, json.dumps(state))
    return nonce, code, ttl


def consume_challenge(*, email: str, code: str) -> dict:
    def transition(state):
        attempts = int(state.get("attempts", 0))
        if attempts >= max(1, int(settings.PASSWORD_RESET_MAX_ATTEMPTS)):
            return None, ValueError("Invalid or expired code"), True
        expected = _digest("code", email_identity(email) + ":" + state["nonce"] + ":" + code)
        if not hmac.compare_digest(str(state.get("hash", "")), expected) or not state.get("uid"):
            state["attempts"] = attempts + 1
            consume = state["attempts"] >= max(1, int(settings.PASSWORD_RESET_MAX_ATTEMPTS))
            return None, ValueError("Invalid or expired code"), consume
        return state, None, True
    return update_challenge(_key(email), transition)


def password_is_current(user, state: dict) -> bool:
    return eligible(user) and hmac.compare_digest(_digest("password", user.hashed_password), state["password"])


def deliver_code(*, email: str, nonce: str, code: str, ttl: int) -> None:
    """Recipient errors must not change the public response and disclose an account.

    The request probes SMTP before accepting any address. Delivery runs after the
    neutral 202 response; a subsequent failure invalidates only this challenge.
    """
    try:
        email_sender.send_password_reset_code_email(to_email=email, code=code, ttl_seconds=ttl)
    except Exception:
        log.warning("Password reset email delivery failed")
        try:
            update_challenge(_key(email), lambda state: (None, None, state.get("nonce") == nonce))
        except (ValueError, RedisError):
            pass
