from fastapi import Header, HTTPException

from app.core.config import settings


async def require_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    token = (settings.ADMIN_TOKEN or "").strip()
    if not token:
        return
    if (x_admin_token or "").strip() != token:
        raise HTTPException(status_code=401, detail="Invalid admin token")

