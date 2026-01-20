import asyncio
import hashlib
import time
from datetime import timedelta
from typing import Iterable

import httpx
from jose import jwt, JWTError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings


class AnalyticsMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        endpoint: str,
        skip_paths: Iterable[str],
        timeout_s: float,
        ip_hash_secret: str,
        anon_cookie: str = "anon_id",
        session_cookie: str = "session_id",
    ):
        super().__init__(app)
        self.endpoint = endpoint.rstrip("/")
        self.skip_paths = list(skip_paths)
        self.timeout_s = timeout_s
        self.ip_hash_secret = ip_hash_secret
        self.anon_cookie = anon_cookie
        self.session_cookie = session_cookie

    def _should_skip(self, path: str) -> bool:
        for prefix in self.skip_paths:
            if path == prefix or path.startswith(prefix + "/"):
                return True
        return False

    def _hash_ip(self, ip: str | None) -> str | None:
        if not ip:
            return None
        raw = f"{self.ip_hash_secret}:{ip}".encode("utf-8")
        return hashlib.sha256(raw).hexdigest()

    def _extract_user_id(self, request: Request) -> int | None:
        auth_header = request.headers.get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            return None
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
            sub = payload.get("sub")
            if sub is None:
                return None
            return int(sub)
        except (JWTError, ValueError):
            return None

    def _derive_anon_id(self, ip_hash: str | None, user_agent: str | None) -> str | None:
        if not ip_hash and not user_agent:
            return None
        seed = f"{self.ip_hash_secret}:{ip_hash or ''}:{user_agent or ''}"
        return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:32]

    def _ensure_cookie(self, request: Request, name: str, ttl_seconds: int, fallback: str | None = None) -> str:
        value = request.cookies.get(name)
        if value:
            return value
        if fallback:
            return fallback
        seed = f"{time.time_ns()}:{request.client.host if request.client else ''}:{name}"
        return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:32]

    async def _send(self, payload: dict) -> None:
        url = f"{self.endpoint}/analytics/events"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_s) as client:
                await client.post(url, json=payload)
        except Exception:
            return

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if self._should_skip(path) or not settings.ANALYTICS_ENABLED:
            return await call_next(request)

        user_agent = request.headers.get("user-agent")
        referrer = request.headers.get("referer")
        ip_hash = self._hash_ip(request.client.host if request.client else None)
        user_id = self._extract_user_id(request)

        derived_anon_id = self._derive_anon_id(ip_hash, user_agent)
        anon_id = self._ensure_cookie(
            request,
            self.anon_cookie,
            settings.ANALYTICS_COOKIE_MAX_AGE_DAYS * 86400,
            fallback=derived_anon_id,
        )
        session_id = self._ensure_cookie(request, self.session_cookie, settings.ANALYTICS_SESSION_MAX_AGE_HOURS * 3600)

        response: Response = await call_next(request)

        if self.anon_cookie not in request.cookies:
            response.set_cookie(
                self.anon_cookie,
                anon_id,
                max_age=settings.ANALYTICS_COOKIE_MAX_AGE_DAYS * 86400,
                samesite="lax",
                httponly=True,
            )
        if self.session_cookie not in request.cookies:
            response.set_cookie(
                self.session_cookie,
                session_id,
                max_age=settings.ANALYTICS_SESSION_MAX_AGE_HOURS * 3600,
                samesite="lax",
                httponly=True,
            )

        payload = {
            "event_type": "api_request",
            "user_id": user_id,
            "anon_id": anon_id,
            "session_id": session_id,
            "path": path,
            "method": request.method,
            "status_code": response.status_code,
            "user_agent": user_agent,
            "referrer": referrer,
            "ip": request.client.host if request.client else None,
            "ip_hash": ip_hash,
            "request_id": request.headers.get("x-request-id") or getattr(request.state, "request_id", None),
            "service": "gateway",
            "is_authenticated": bool(user_id),
        }
        asyncio.create_task(self._send(payload))
        return response
