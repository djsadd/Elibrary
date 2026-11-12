import asyncio
import hashlib
import time
from collections import OrderedDict

import httpx
from fastapi import HTTPException
from app.core.config import settings
from app.schemas.auth import IntrospectResponse

# Introspection is called for every proxied request. Bursts (e.g. the PDF reader fetching
# byte ranges) used to open a new connection and hit AuthService once per request, overloading it.
# Keep one pooled client, coalesce concurrent lookups of the same token and cache positive
# answers briefly. Revocation/role changes therefore take effect within INTROSPECT_CACHE_TTL_S.
INTROSPECT_CACHE_TTL_S = 15.0
_CACHE_MAX = 5000

_client: httpx.AsyncClient | None = None
_cache: "OrderedDict[str, tuple[float, IntrospectResponse]]" = OrderedDict()
_inflight: dict[str, asyncio.Future] = {}


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=5.0,
            follow_redirects=False,
            trust_env=False,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        )
    return _client


async def _fetch(token: str) -> IntrospectResponse:
    base = str(settings.AUTH_SERVICE_URL).rstrip("/")
    url = base + ("/introspect" if base.endswith("/auth") else "/auth/introspect")
    try:
        response = await _get_client().post(url, json={"token": token})
        response.raise_for_status()
        return IntrospectResponse.model_validate(response.json())
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, "Authentication service unavailable") from exc


async def introspect(token: str) -> IntrospectResponse:
    key = hashlib.sha256(token.encode()).hexdigest()
    now = time.monotonic()

    hit = _cache.get(key)
    if hit and hit[0] > now:
        _cache.move_to_end(key)
        return hit[1]
    if hit:
        _cache.pop(key, None)

    pending = _inflight.get(key)
    if pending is not None:
        return await asyncio.shield(pending)

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _inflight[key] = fut
    try:
        data = await _fetch(token)
        if data.active and data.user_id:
            _cache[key] = (time.monotonic() + INTROSPECT_CACHE_TTL_S, data)
            while len(_cache) > _CACHE_MAX:
                _cache.popitem(last=False)
        fut.set_result(data)
        return data
    except asyncio.CancelledError:
        fut.cancel()  # waiters retry on their own next request
        raise
    except Exception as exc:
        fut.set_exception(exc)
        fut.exception()  # mark retrieved so an unawaited future doesn't log a warning
        raise
    finally:
        _inflight.pop(key, None)
