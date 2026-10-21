import hmac
from fastapi import Header, HTTPException
from core.config import settings


def require_internal_token(x_service_token: str | None = Header(default=None)) -> None:
    expected = settings.INTERNAL_API_TOKEN
    if not expected or len(expected) < 32:
        raise HTTPException(503, "Service authentication is not configured")
    if not x_service_token or not hmac.compare_digest(x_service_token, expected):
        raise HTTPException(401, "Invalid service token")
