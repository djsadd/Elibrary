from typing import List, Optional
from pydantic import BaseModel
from fastapi import Depends, HTTPException, Request
import httpx

from app.core.config import settings

_INTROSPECT_URL = (str(settings.AUTH_SERVICE_URL).rstrip("/") + "/auth/introspect")

_client = httpx.AsyncClient(timeout=10.0)


class AuthUser(BaseModel):
    user_id: int
    roles: List[str] = []


async def get_current_user(request: Request) -> AuthUser:
    auth = request.headers.get("authorization", "")
    token = auth.split(" ", 1)[1] if auth.lower().startswith("bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        resp = await _client.post(_INTROSPECT_URL, json={"token": token})
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Auth service unavailable")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid token")

    data = resp.json()
    if not data.get("active"):
        raise HTTPException(status_code=401, detail="Token inactive")

    return AuthUser(
        user_id=int(data.get("user_id", 0)),
        roles=data.get("roles") or []
    )


def require_roles(*required: str):
    required_set = {r.lower() for r in required if r}

    async def _checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if not required_set:
            return user
        user_roles = {r.lower() for r in user.roles}
        if user_roles.intersection(required_set):
            return user
        raise HTTPException(status_code=403, detail="Forbidden")
    return _checker
