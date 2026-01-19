from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time

from app.core.config import settings
from app.core.redis import r


def _secret() -> bytes:
    raw = settings.TWOFA_CODE_SECRET or settings.JWT_SECRET_KEY
    return str(raw or "").encode("utf-8")


def _hash_code(code: str) -> str:
    return hmac.new(_secret(), code.encode("utf-8"), hashlib.sha256).hexdigest()


def _key(challenge_id: str) -> str:
    return f"2fa:challenge:{challenge_id}"


def create_challenge(*, user_id: int) -> tuple[str, str, int]:
    ttl = int(settings.TWOFA_TTL_SECONDS)
    length = int(settings.TWOFA_CODE_LENGTH)
    if ttl < 30:
        ttl = 30
    if length < 4 or length > 10:
        length = 6

    challenge_id = secrets.token_urlsafe(24)
    code_int = secrets.randbelow(10**length)
    code = f"{code_int:0{length}d}"

    now = int(time.time())
    payload = {
        "uid": int(user_id),
        "hash": _hash_code(code),
        "attempts": 0,
        "exp": now + ttl,
        "resend_after": now + int(settings.TWOFA_RESEND_COOLDOWN_SECONDS),
    }
    r.setex(_key(challenge_id), ttl, json.dumps(payload))
    return challenge_id, code, ttl


def verify_code(*, challenge_id: str, code: str) -> int:
    raw = r.get(_key(challenge_id))
    if not raw:
        raise ValueError("Challenge not found")

    try:
        payload = json.loads(raw)
    except Exception:
        r.delete(_key(challenge_id))
        raise ValueError("Challenge invalid")

    now = int(time.time())
    exp = int(payload.get("exp") or 0)
    if exp and now >= exp:
        r.delete(_key(challenge_id))
        raise ValueError("Challenge expired")

    attempts = int(payload.get("attempts") or 0)
    if attempts >= int(settings.TWOFA_MAX_ATTEMPTS):
        r.delete(_key(challenge_id))
        raise ValueError("Too many attempts")

    expected = str(payload.get("hash") or "")
    got = _hash_code(str(code or "").strip())
    if not hmac.compare_digest(expected, got):
        attempts += 1
        payload["attempts"] = attempts
        ttl = max(exp - now, 1) if exp else int(settings.TWOFA_TTL_SECONDS)
        r.setex(_key(challenge_id), int(ttl), json.dumps(payload))
        raise ValueError("Invalid code")

    user_id = int(payload.get("uid") or 0)
    r.delete(_key(challenge_id))
    if user_id <= 0:
        raise ValueError("Challenge invalid")
    return user_id


def resend_code(*, challenge_id: str) -> tuple[int, str, int]:
    raw = r.get(_key(challenge_id))
    if not raw:
        raise ValueError("Challenge not found")

    try:
        payload = json.loads(raw)
    except Exception:
        r.delete(_key(challenge_id))
        raise ValueError("Challenge invalid")

    now = int(time.time())
    exp = int(payload.get("exp") or 0)
    if exp and now >= exp:
        r.delete(_key(challenge_id))
        raise ValueError("Challenge expired")

    resend_after = int(payload.get("resend_after") or 0)
    if resend_after and now < resend_after:
        raise PermissionError(str(resend_after - now))

    length = int(settings.TWOFA_CODE_LENGTH)
    code_int = secrets.randbelow(10**length)
    code = f"{code_int:0{length}d}"
    payload["hash"] = _hash_code(code)
    payload["resend_after"] = now + int(settings.TWOFA_RESEND_COOLDOWN_SECONDS)

    ttl = max(exp - now, 1) if exp else int(settings.TWOFA_TTL_SECONDS)
    r.setex(_key(challenge_id), int(ttl), json.dumps(payload))
    return int(payload.get("uid") or 0), code, int(ttl)

