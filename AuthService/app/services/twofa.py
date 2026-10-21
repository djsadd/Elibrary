from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time

from app.core.config import settings
from app.core.redis import r
from app.services.challenge_store import update_challenge


def _secret() -> bytes:
    raw = settings.TWOFA_CODE_SECRET or settings.JWT_SECRET_KEY
    return str(raw or "").encode("utf-8")


def _hash_code(code: str) -> str:
    return hmac.new(_secret(), code.encode("utf-8"), hashlib.sha256).hexdigest()


def _key(challenge_id: str) -> str:
    return f"2fa:challenge:{challenge_id}"


def create_challenge(*, user_id: int, credential: str | None = None) -> tuple[str, str, int]:
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
        "ver": str(r.get(f"session:version:{int(user_id)}") or "0"),
        "credential": credential,
        "hash": _hash_code(code),
        "attempts": 0,
        "exp": now + ttl,
        "resend_after": now + int(settings.TWOFA_RESEND_COOLDOWN_SECONDS),
    }
    r.setex(_key(challenge_id), ttl, json.dumps(payload))
    return challenge_id, code, ttl


def verify_code(*, challenge_id: str, code: str, with_context: bool = False) -> int | dict:
    def transition(state):
        current_version = str(r.get(f'session:version:{int(state.get("uid", 0))}') or "0")
        if str(state.get("ver", "0")) != current_version:
            return None, ValueError("Challenge invalidated"), True
        attempts = int(state.get("attempts", 0))
        if attempts >= int(settings.TWOFA_MAX_ATTEMPTS):
            return None, ValueError("Too many attempts"), True
        if not hmac.compare_digest(str(state.get("hash") or ""), _hash_code(str(code or "").strip())):
            state["attempts"] = attempts + 1
            return None, ValueError("Invalid code"), False
        uid = int(state.get("uid", 0))
        result = {"uid": uid, "ver": str(state.get("ver", "0")), "credential": state.get("credential")} if with_context else uid
        return result, None if uid > 0 else ValueError("Challenge invalid"), True
    return update_challenge(_key(challenge_id), transition)


def resend_code(*, challenge_id: str) -> tuple[int, str, int]:
    def transition(state):
        now = int(time.time())
        if now < int(state.get("resend_after", 0)):
            return None, PermissionError(str(state["resend_after"] - now)), False
        if int(state.get("attempts", 0)) >= int(settings.TWOFA_MAX_ATTEMPTS):
            return None, ValueError("Too many attempts"), True
        length = int(settings.TWOFA_CODE_LENGTH)
        code = f"{secrets.randbelow(10**length):0{length}d}"
        state["hash"] = _hash_code(code)
        state["resend_after"] = now + int(settings.TWOFA_RESEND_COOLDOWN_SECONDS)
        return (int(state["uid"]), code, max(int(state["exp"]) - now, 1)), None, False
    return update_challenge(_key(challenge_id), transition)
