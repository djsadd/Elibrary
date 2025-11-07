import asyncio
import httpx
import logging
from typing import Optional
from app.core.config import settings
from app.schemas.auth import IntrospectResponse

log = logging.getLogger(__name__)

async def _post_json(url: str, json: dict, timeout: float) -> httpx.Response:
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.post(url, json=json)

async def _retry(fn, retries: int, backoff: float):
    last_exc = None
    for attempt in range(retries + 1):
        try:
            return await fn()
        except Exception as e:
            last_exc = e
            await asyncio.sleep(backoff * (attempt + 1))
    raise last_exc

async def introspect(token: str) -> Optional[IntrospectResponse]:
    url = f"{settings.AUTH_SERVICE_URL}/api/v1/auth/introspect"
    async def call():
        resp = await _post_json(url, {"token": token}, settings.PROXY_TIMEOUT_S)
        resp.raise_for_status()
        return resp
    try:
        resp = await _retry(call, settings.PROXY_RETRIES, settings.PROXY_RETRY_BACKOFF_S)
        data = resp.json()
        return IntrospectResponse(**data)
    except Exception as e:
        log.warning("Auth introspect failed: %s", e)
        return None
