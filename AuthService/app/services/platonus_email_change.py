from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from app.core.config import settings
from app.core.redis import r
from app.services.challenge_store import update_challenge


def _secret() -> bytes:
    raw = settings.TWOFA_CODE_SECRET or settings.JWT_SECRET_KEY
    return str(raw or "").encode("utf-8")


def _hash_code(code: str) -> str:
    return hmac.new(_secret(), code.encode("utf-8"), hashlib.sha256).hexdigest()


def _key(challenge_id: str) -> str:
    return f"platonus:email_change:{challenge_id}"


def create_challenge(*, payload: dict[str, Any], ttl_seconds: int | None = None) -> tuple[str, int]:
    ttl = int(ttl_seconds or settings.TWOFA_TTL_SECONDS)
    if ttl < 60:
        ttl = 60

    challenge_id = secrets.token_urlsafe(24)
    now = int(time.time())
    state = {
        "payload": payload,
        "email": None,
        "hash": None,
        "attempts": 0,
        "exp": now + ttl,
        "resend_after": now,
    }
    r.setex(_key(challenge_id), ttl, json.dumps(state, ensure_ascii=False, separators=(",", ":")))
    return challenge_id, ttl


def request_code(*, challenge_id: str, email: str) -> tuple[str, int]:
    def transition(state):
        now = int(time.time())
        if now < int(state.get("resend_after", 0)):
            return None, PermissionError(str(state["resend_after"] - now)), False
        # Resending or changing email must never reset the attempt budget.
        if int(state.get("attempts", 0)) >= int(settings.TWOFA_MAX_ATTEMPTS):
            return None, ValueError("Too many attempts"), True
        length = int(settings.TWOFA_CODE_LENGTH)
        code = f"{secrets.randbelow(10**length):0{length}d}"
        state["email"] = email.strip().lower()
        state["hash"] = _hash_code(code)
        state["resend_after"] = now + int(settings.TWOFA_RESEND_COOLDOWN_SECONDS)
        return (code, max(int(state["exp"]) - now, 1)), None, False
    return update_challenge(_key(challenge_id), transition)


def verify_code(*, challenge_id: str, email: str, code: str) -> dict[str, Any]:
    def transition(state):
        attempts = int(state.get("attempts", 0))
        if attempts >= int(settings.TWOFA_MAX_ATTEMPTS):
            return None, ValueError("Too many attempts"), True
        valid = (str(state.get("email") or "").lower() == email.strip().lower()
                 and bool(state.get("hash"))
                 and hmac.compare_digest(state["hash"], _hash_code(str(code or "").strip())))
        if not valid:
            state["attempts"] = attempts + 1
            return None, ValueError("Invalid code"), False
        return state.get("payload") or {}, None, True
    return update_challenge(_key(challenge_id), transition)


def peek_payload(*, challenge_id: str) -> dict[str, Any]:
    raw = r.get(_key(challenge_id))
    if not raw:
        raise ValueError("Challenge not found")

    try:
        state = json.loads(raw)
    except Exception:
        r.delete(_key(challenge_id))
        raise ValueError("Challenge invalid")

    payload = state.get("payload") or {}
    if not isinstance(payload, dict):
        return {}
    return payload
