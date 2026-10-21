import hmac
from fastapi import Header, HTTPException
from app.core.config import settings

async def require_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    expected = settings.ADMIN_TOKEN.strip()
    if len(expected) < 32:
        raise HTTPException(503, "Search administration is not configured")
    if not x_admin_token or not hmac.compare_digest(x_admin_token, expected):
        raise HTTPException(401, "Invalid admin token")
