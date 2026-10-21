from fastapi import Depends, HTTPException, Request
import hmac
from pydantic import BaseModel, Field
from app.core.db import SessionLocal
from app.models.user import User
from app.schemas.auth import IntrospectRequest
from app.utils.tokens import consume_refresh, credential_fingerprint, decode, access_is_revoked, session_is_current


class AuthUser(BaseModel):
    user_id: int
    roles: list[str] = Field(default_factory=list)
    session_version: str | None = None
    credential: str | None = None


def user_from_token(token: str, token_type: str = "access") -> AuthUser | None:
    claims = decode(token)
    if not claims or claims["typ"] != token_type:
        return None
    if not session_is_current(claims):
        return None
    if token_type == "access" and access_is_revoked(claims):
        return None
    with SessionLocal() as db:
        user = db.get(User, int(claims["sub"]))
        if not user or not user.is_active:
            return None
        credential = claims.get("pwd")
        if credential is not None and not hmac.compare_digest(
                str(credential).encode(), credential_fingerprint(user.hashed_password).encode()):
            return None
        # Use current database privileges, never stale roles from a JWT.
        return AuthUser(user_id=user.id, roles=[r.strip() for r in (user.role or "").split(",") if r.strip()],
                        session_version=claims["ver"], credential=credential)


def get_current_user(request: Request) -> AuthUser:
    auth = request.headers.get("authorization", "")
    token = auth.split(" ", 1)[1].strip() if auth.lower().startswith("bearer ") else ""
    user = user_from_token(token)
    if not user:
        raise HTTPException(401, "Invalid access token", headers={"WWW-Authenticate": "Bearer"})
    return user


def require_roles(*required: str):
    allowed = {r.lower() for r in required}
    def checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if allowed and not allowed.intersection(r.lower() for r in user.roles):
            raise HTTPException(403, "Forbidden")
        return user
    return checker


def get_current_user_from_refresh_body(body: IntrospectRequest) -> AuthUser:
    user = user_from_token(body.token, "refresh")
    if not user:
        raise HTTPException(401, "Invalid refresh token")
    consume_refresh(decode(body.token))
    return user


def get_current_user_from_access_body_optional(body: IntrospectRequest) -> AuthUser | None:
    return user_from_token(body.token)
