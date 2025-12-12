# app/services/proxy.py
import asyncio
import logging
from typing import Iterable, Mapping
from urllib.parse import urljoin

import httpx
from fastapi import Request
from starlette.responses import StreamingResponse, Response

from app.core.config import settings

log = logging.getLogger(__name__)

_CLIENT = httpx.AsyncClient(
    timeout=httpx.Timeout(settings.PROXY_TIMEOUT_S),
    limits=httpx.Limits(max_keepalive_connections=100, max_connections=200),
    follow_redirects=False,
)


_HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade",
}


def _strip_hop_by_hop(headers: Mapping[str, str]) -> dict:
    return {k: v for k, v in headers.items() if k.lower() not in _HOP_BY_HOP}


def _filtered_headers(request: Request) -> dict:
    excluded = {"host", "content-length"}
    h = {k: v for k, v in request.headers.items() if k.lower() not in excluded}

    # Проверяем Authorization
    auth = request.headers.get("authorization")
    if auth:
        h["Authorization"] = auth
        log.debug("Authorization token present: %s", auth[:10] + "…")  # показываем только начало токена
    else:
        log.warning("Authorization token missing in incoming request!")

    rid = getattr(request.state, "request_id", None)
    if rid:
        h["X-Request-ID"] = rid

    user = getattr(request.state, "user", None)
    if isinstance(user, dict):
        if user.get("user_id"):
            h["X-User-ID"] = str(user["user_id"])
        roles = user.get("roles")
        if roles:
            h["X-User-Roles"] = ",".join(map(str, roles))

    client_host = request.client.host if request.client else ""
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    chain = request.headers.get("x-forwarded-for")
    h["X-Forwarded-For"] = f"{chain}, {client_host}" if chain else client_host
    h["X-Forwarded-Proto"] = proto
    h["X-Forwarded-Host"] = host

    return _strip_hop_by_hop(h)


async def _retry(call, retries: int, backoff: float, method: str):
    """
    Ретрии: только на сетевые ошибки/таймауты.
    Для небезопасных методов (POST/PUT/...), ретраим только при сетевых исключениях (и то аккуратно).
    """
    attempt = 0
    while True:
        try:
            return await call()
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.NetworkError) as e:
            if attempt >= retries:
                raise
            delay = backoff * (2 ** attempt) + (0.1 * backoff) * (attempt + 1) * asyncio.get_event_loop().time() % 0.1
            log.warning("Upstream %s failed (%s). Retry %d in %.2fs", method, e.__class__.__name__, attempt + 1, delay)
            await asyncio.sleep(delay)
            attempt += 1


def _join_url(base_url, path: str, query: str) -> str:
    base = str(base_url)              # <-- ключевая строка
    if not base.endswith("/"):
        base += "/"
    from urllib.parse import urljoin
    url = urljoin(base, path.lstrip("/"))
    if query:
        url = f"{url}?{query}"
    return url


async def forward(request: Request, base_url: str, path_suffix: str = "") -> Response:
    """
    Прокси в апстрим. Логирует всё от фронтенда и форвардит запрос.
    """
    # --- Логируем запрос от фронтенда ---
    try:
        body_bytes = await request.body()
        body_text = body_bytes.decode("utf-8") if body_bytes else "(empty)"
    except Exception as e:
        body_text = f"(error reading body: {e})"

    log.debug("=== Incoming request from frontend ===")
    log.debug(f"Method: {request.method}")
    log.debug(f"URL: {request.url}")
    log.debug(f"Query params: {dict(request.query_params)}")
    log.debug(f"Headers: {dict(request.headers)}")
    log.debug(f"Body: {body_text}")
    log.debug("======================================")

    # --- Формируем upstream URL и заголовки ---
    upstream_path = path_suffix or request.url.path
    # Ensure base_url is clean (no stray spaces)
    target = _join_url(str(base_url).strip(), upstream_path, request.url.query)
    headers = _filtered_headers(request)

    # Логируем, что уйдёт в апстрим
    log.debug("=== Forwarding to upstream ===")
    log.debug(f"Target URL: {target}")
    log.debug(f"Method: {request.method}")
    log.debug(f"Headers: {headers}")
    log.debug(f"Body length: {len(body_bytes)} bytes")
    log.debug("=================================")

    async def call():
        return await _CLIENT.request(
            method=request.method,
            url=target,
            headers=headers,
            content=body_bytes
        )

    try:
        resp = await _retry(call, settings.PROXY_RETRIES, settings.PROXY_RETRY_BACKOFF_S, request.method)

        response_headers = _strip_hop_by_hop(resp.headers)

        async def _aiter():
            async for chunk in resp.aiter_bytes():
                yield chunk

        return StreamingResponse(
            _aiter(),
            status_code=resp.status_code,
            headers=response_headers,
            media_type=resp.headers.get("content-type")
        )

    except Exception as e:
        log.error("Proxy error to %s: %s", target, e)
        return Response(
            content=b'{"detail":"Upstream error"}',
            status_code=502,
            media_type="application/json",
            headers={"Cache-Control": "no-store"}
        )

