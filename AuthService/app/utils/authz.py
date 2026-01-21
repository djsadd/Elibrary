from typing import List

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel

from app.utils.tokens import decode
from app.schemas.auth import IntrospectRequest


class AuthUser(BaseModel):
    user_id: int
    roles: List[str] = []


def _extract_bearer(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    return auth.split(" ", 1)[1]


def get_current_user(request: Request) -> AuthUser:
    token = _extract_bearer(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    data = decode(token)
    if not data or data.get("typ") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")

    sub = data.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    roles = data.get("roles") or []
    if isinstance(roles, str):
        roles = [roles]

    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    return AuthUser(user_id=user_id, roles=[str(r) for r in roles if r is not None])


def require_roles(*required: str):
    required_set = {r.strip().lower() for r in required if r and r.strip()}

    def _checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if not required_set:
            return user
        user_roles = {str(r).strip().lower() for r in (user.roles or []) if r}
        if user_roles.intersection(required_set):
            return user
        raise HTTPException(status_code=403, detail="Forbidden")

    return _checker


def get_current_user_from_refresh_body(body: IntrospectRequest) -> AuthUser:
    data = decode(body.token)
    if not data or data.get("typ") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh")
    sub = data.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="Invalid refresh")
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid refresh")
    return AuthUser(user_id=user_id, roles=[])


def get_current_user_from_access_body_optional(body: IntrospectRequest) -> AuthUser | None:
    data = decode(body.token)
    if not data or data.get("typ") != "access":
        return None
    sub = data.get("sub")
    if sub is None:
        return None
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        return None
    roles = data.get("roles") or []
    if isinstance(roles, str):
        roles = [roles]
    return AuthUser(user_id=user_id, roles=[str(r) for r in roles if r is not None])
