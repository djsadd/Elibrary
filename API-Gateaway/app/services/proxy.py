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

# --- глобальный httpx клиент с пулом/таймаутами ---
_CLIENT = httpx.AsyncClient(
    timeout=httpx.Timeout(settings.PROXY_TIMEOUT_S),
    limits=httpx.Limits(max_keepalive_connections=100, max_connections=200),
    follow_redirects=False,
    # http2=True,  ← Удали или закомментируй эту строку
)


# RFC 7230 hop-by-hop заголовки
_HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade",
}


def _strip_hop_by_hop(headers: Mapping[str, str]) -> dict:
    return {k: v for k, v in headers.items() if k.lower() not in _HOP_BY_HOP}


def _filtered_headers(request: Request) -> dict:
    # не пробрасываем host/content-length — httpx поставит сам
    excluded = {"host", "content-length"}
    h = {k: v for k, v in request.headers.items() if k.lower() not in excluded}

    # корреляция
    rid = getattr(request.state, "request_id", None)
    if rid:
        h["X-Request-ID"] = rid

    # прокидываем пользователя (если у тебя auth-мидлварь кладёт это)
    user = getattr(request.state, "user", None)
    if isinstance(user, dict):
        if user.get("user_id"):
            h["X-User-ID"] = str(user["user_id"])
        roles = user.get("roles")
        if roles:
            h["X-User-Roles"] = ",".join(map(str, roles))

    # X-Forwarded-*
    client_host = request.client.host if request.client else ""
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    chain = request.headers.get("x-forwarded-for")
    h["X-Forwarded-For"] = f"{chain}, {client_host}" if chain else client_host
    h["X-Forwarded-Proto"] = proto
    h["X-Forwarded-Host"] = host

    # финальная очистка hop-by-hop
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
            # экспоненциальный бэкофф с джиттером
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
    Прокси в апстрим. Ожидается, что caller передаёт 'path_suffix' — это уже «хвост» без /api/{service}.
    Если path_suffix не передан — прокинем весь request.url.path (как у тебя сейчас).
    """
    # путь и query
    upstream_path = path_suffix or request.url.path
    target = _join_url(base_url, upstream_path, request.url.query)
    headers = _filtered_headers(request)

    # тело (можно сделать stream upload, если потребуется)
    body = await request.body()

    async def call():
        return await _CLIENT.request(
            method=request.method,
            url=target,
            headers=headers,
            content=body
        )

    try:
        resp = await _retry(call, settings.PROXY_RETRIES, settings.PROXY_RETRY_BACKOFF_S, request.method)

        # чистим hop-by-hop и отдаём стримом
        response_headers = _strip_hop_by_hop(resp.headers)

        # Если хочется полностью стримить (без буфера):
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
