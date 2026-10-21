from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets

import jwt
from fastapi import HTTPException
from redis.exceptions import RedisError
from app.core.config import settings
from app.core.redis import r

ISSUER = "elibrary-auth"
AUDIENCE = "elibrary"


def credential_fingerprint(password_hash: str) -> str:
    return hmac.new(settings.JWT_SECRET_KEY.encode(),
                    ("session-credential:" + password_hash).encode(), hashlib.sha256).hexdigest()


def _make(payload: dict, delta: timedelta, *, session_version: str | None = None,
          credential: str | None = None) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    exp = now + delta
    try:
        version = str(r.get(f'session:version:{payload["sub"]}') or "0")
    except RedisError as exc:
        raise HTTPException(503, "Session store unavailable") from exc
    if session_version is not None and version != session_version:
        raise HTTPException(401, "Authentication changed; sign in again")
    # Preserve the credential that was actually verified, including when a reset
    # commits between password verification and token issuance.
    if credential is not None:
        payload = {**payload, "pwd": credential}
    claims = {**payload, "ver": version, "iat": int(now.timestamp()), "exp": int(exp.timestamp()),
              "jti": secrets.token_urlsafe(24), "iss": ISSUER, "aud": AUDIENCE}
    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALG), claims["exp"]


def create_access(user_id: int, roles: str, *, session_version: str | None = None,
                  credential: str | None = None) -> tuple[str, int]:
    token, exp = _make({"sub": str(user_id), "roles": roles.split(","), "typ": "access"}, settings.access_delta,
                       session_version=session_version, credential=credential)
    claims = decode(token)
    try:
        r.setex(f'access:active:{claims["jti"]}', max(exp - int(datetime.now(timezone.utc).timestamp()), 1), str(user_id))
    except RedisError as exc:
        raise HTTPException(503, "Session store unavailable") from exc
    return token, exp


def create_refresh(user_id: int, *, session_version: str | None = None,
                   credential: str | None = None) -> tuple[str, int]:
    token, exp = _make({"sub": str(user_id), "typ": "refresh"}, settings.refresh_delta,
                       session_version=session_version, credential=credential)
    claims = decode(token)
    try:
        r.setex(f'refresh:active:{claims["jti"]}', max(exp - int(datetime.now(timezone.utc).timestamp()), 1), str(user_id))
    except RedisError as exc:
        raise HTTPException(503, "Session store unavailable") from exc
    return token, exp


def consume_refresh(claims: dict) -> None:
    """GETDEL atomically makes every refresh token single use."""
    try:
        owner = r.getdel(f'refresh:active:{claims["jti"]}')
    except RedisError as exc:
        raise HTTPException(503, "Session store unavailable") from exc
    if str(owner) != claims["sub"]:
        raise HTTPException(401, "Invalid or already used refresh token")


def decode(token: str) -> dict | None:
    if not token or len(token) > 8192:
        return None
    try:
        data = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALG],
                          issuer=ISSUER, audience=AUDIENCE,
                          options={"require": ["exp", "iat", "sub", "jti", "typ", "ver"]})
        if data.get("typ") not in {"access", "refresh"} or int(data["sub"]) <= 0:
            return None
        return data
    except (jwt.PyJWTError, ValueError, TypeError):
        return None


def session_is_current(claims: dict) -> bool:
    try:
        return str(r.get(f'session:version:{claims["sub"]}') or "0") == claims["ver"]
    except RedisError as exc:
        raise HTTPException(503, "Session store unavailable") from exc


def access_is_revoked(claims: dict) -> bool:
    try:
        return str(r.get(f'access:active:{claims["jti"]}')) != claims["sub"]
    except RedisError as exc:
        raise HTTPException(503, "Session store unavailable") from exc


def revoke_access(claims: dict) -> None:
    try:
        r.delete(f'access:active:{claims["jti"]}')
    except RedisError as exc:
        raise HTTPException(503, "Session store unavailable") from exc


def invalidate_user_sessions(user_id: int) -> None:
    try:
        r.incr(f'session:version:{user_id}')
    except RedisError as exc:
        raise HTTPException(503, "Session store unavailable") from exc
