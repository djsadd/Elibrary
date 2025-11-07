from fastapi import Request, HTTPException
from app.core.security import get_bearer_token
from app.services.auth_client import introspect


async def auth_required(request: Request):
    token = get_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    data = await introspect(token)
    if not data or not data.active:
        raise HTTPException(status_code=401, detail="Invalid token")
    request.state.user = {"user_id": data.user_id, "roles": data.roles}
    return request.state.user
