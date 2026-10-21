from fastapi import Request, HTTPException, Depends
from app.services.auth_client import introspect


async def auth_required(request: Request):
    header = request.headers.get("authorization", "")
    token = header.split(" ", 1)[1].strip() if header.lower().startswith("bearer ") else ""
    if not token or len(token) > 8192:
        raise HTTPException(401, "Invalid access token", headers={"WWW-Authenticate": "Bearer"})
    data = await introspect(token)
    if not data or not data.active or not data.user_id:
        raise HTTPException(401, "Invalid access token")
    user = {"user_id": str(data.user_id), "roles": data.roles or []}
    request.state.user = user
    return user


async def auth_optional(request: Request):
    if not request.headers.get("authorization"):
        return None
    try:
        return await auth_required(request)
    except HTTPException:
        return None


async def admin_required(user=Depends(auth_required)):
    if not {"admin", "librarian"}.intersection(r.lower() for r in user["roles"]):
        raise HTTPException(403, "Forbidden")
    return user


async def staff_required(user=Depends(auth_required)):
    if not {"admin", "librarian", "editor"}.intersection(r.lower() for r in user["roles"]):
        raise HTTPException(403, "Forbidden")
    return user
