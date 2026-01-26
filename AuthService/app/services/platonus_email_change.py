from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from app.core.config import settings
from app.core.redis import r


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
    raw = r.get(_key(challenge_id))
    if not raw:
        raise ValueError("Challenge not found")

    try:
        state = json.loads(raw)
    except Exception:
        r.delete(_key(challenge_id))
        raise ValueError("Challenge invalid")

    now = int(time.time())
    exp = int(state.get("exp") or 0)
    if exp and now >= exp:
        r.delete(_key(challenge_id))
        raise ValueError("Challenge expired")

    resend_after = int(state.get("resend_after") or 0)
    if resend_after and now < resend_after:
        raise PermissionError(str(resend_after - now))

    length = int(settings.TWOFA_CODE_LENGTH)
    if length < 4 or length > 10:
        length = 6
    code_int = secrets.randbelow(10**length)
    code = f"{code_int:0{length}d}"

    state["email"] = str(email or "").strip().lower()
    state["hash"] = _hash_code(code)
    state["attempts"] = 0
    state["resend_after"] = now + int(settings.TWOFA_RESEND_COOLDOWN_SECONDS)

    ttl = max(exp - now, 1) if exp else int(settings.TWOFA_TTL_SECONDS)
    r.setex(_key(challenge_id), int(ttl), json.dumps(state, ensure_ascii=False, separators=(",", ":")))
    return code, int(ttl)


def verify_code(*, challenge_id: str, email: str, code: str) -> dict[str, Any]:
    raw = r.get(_key(challenge_id))
    if not raw:
        raise ValueError("Challenge not found")

    try:
        state = json.loads(raw)
    except Exception:
        r.delete(_key(challenge_id))
        raise ValueError("Challenge invalid")

    now = int(time.time())
    exp = int(state.get("exp") or 0)
    if exp and now >= exp:
        r.delete(_key(challenge_id))
        raise ValueError("Challenge expired")

    attempts = int(state.get("attempts") or 0)
    if attempts >= int(settings.TWOFA_MAX_ATTEMPTS):
        r.delete(_key(challenge_id))
        raise ValueError("Too many attempts")

    expected_email = str(state.get("email") or "").strip().lower()
    email = str(email or "").strip().lower()
    if not expected_email or expected_email != email:
        raise ValueError("Email mismatch")

    expected_hash = str(state.get("hash") or "")
    got = _hash_code(str(code or "").strip())
    if not expected_hash or not hmac.compare_digest(expected_hash, got):
        attempts += 1
        state["attempts"] = attempts
        ttl = max(exp - now, 1) if exp else int(settings.TWOFA_TTL_SECONDS)
        r.setex(_key(challenge_id), int(ttl), json.dumps(state, ensure_ascii=False, separators=(",", ":")))
        raise ValueError("Invalid code")

    payload = state.get("payload") or {}
    if not isinstance(payload, dict):
        payload = {}
    r.delete(_key(challenge_id))
    return payload


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
