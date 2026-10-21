from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
import httpx
from config import settings


class AuthUser(BaseModel):
    user_id: int
    roles: list[str] = Field(default_factory=list)
    token: str = Field(default="", exclude=True, repr=False)


def introspection_url() -> str:
    base = str(settings.AUTH_SERVICE_URL).rstrip("/")
    return base + ("/introspect" if base.endswith("/auth") else "/auth/introspect")


async def get_current_user(request: Request) -> AuthUser:
    auth = request.headers.get("authorization", "")
    token = auth.split(" ", 1)[1].strip() if auth.lower().startswith("bearer ") else ""
    if not token or len(token) > 8192:
        raise HTTPException(401, "Invalid access token", headers={"WWW-Authenticate": "Bearer"})
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False, trust_env=False) as client:
            response = await client.post(introspection_url(), json={"token": token})
        if response.status_code != 200:
            raise HTTPException(503, "Authentication service unavailable")
        data = response.json()
        if data.get("active") is not True:
            raise HTTPException(401, "Invalid access token")
        uid = int(data["user_id"])
        roles = data.get("roles", [])
        if uid <= 0 or not isinstance(roles, list) or not all(isinstance(r, str) for r in roles):
            raise ValueError("Invalid authentication response")
        return AuthUser(user_id=uid, roles=roles, token=token)
    except (httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
        raise HTTPException(503, "Authentication service unavailable") from exc


def require_roles(*required: str):
    allowed = {r.lower() for r in required}
    async def checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if allowed and not allowed.intersection(r.lower() for r in user.roles):
            raise HTTPException(403, "Forbidden")
        return user
    return checker
