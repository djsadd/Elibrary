import httpx
from fastapi import HTTPException
from app.core.config import settings
from app.schemas.auth import IntrospectResponse


async def introspect(token: str) -> IntrospectResponse:
    base = str(settings.AUTH_SERVICE_URL).rstrip("/")
    url = base + ("/introspect" if base.endswith("/auth") else "/auth/introspect")
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False, trust_env=False) as client:
            response = await client.post(url, json={"token": token})
        response.raise_for_status()
        return IntrospectResponse.model_validate(response.json())
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, "Authentication service unavailable") from exc
