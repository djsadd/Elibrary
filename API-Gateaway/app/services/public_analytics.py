import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional

import httpx
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.schemas.public_analytics import PublicPageViewIn


_CLIENT = httpx.AsyncClient(
    timeout=httpx.Timeout(settings.ANALYTICS_TIMEOUT_S),
    limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
    follow_redirects=False,
)


def _extract_client_ip(request: Request) -> Optional[str]:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        for p in parts:
            if p.lower() != "unknown":
                return p
    xri = request.headers.get("x-real-ip")
    if xri and xri.strip():
        return xri.strip()
    cfc = request.headers.get("cf-connecting-ip")
    if cfc and cfc.strip():
        return cfc.strip()
    return request.client.host if request.client else None


def _hash_ip(ip: Optional[str]) -> Optional[str]:
    if not ip:
        return None
    raw = f"{settings.ANALYTICS_IP_HASH_SECRET}:{ip}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _ensure_cookie(request: Request, response: Response, name: str, max_age_s: int, fallback: Optional[str] = None) -> str:
    existing = request.cookies.get(name)
    if existing:
        return existing
    value = fallback or secrets.token_urlsafe(16)
    response.set_cookie(
        name,
        value,
        max_age=max_age_s,
        samesite="lax",
        httponly=True,
    )
    return value


async def track_public_page_view(request: Request, body: PublicPageViewIn) -> Response:
    """
    Accepts a lightweight public page view event and forwards it to AnalyticsService as event_type=page_view.
    Middleware is configured to skip this path to avoid double-counting.
    """
    response = Response(status_code=204)

    user_agent = request.headers.get("user-agent")
    client_ip = _extract_client_ip(request)
    ip_hash = _hash_ip(client_ip)

    anon_id = _ensure_cookie(
        request,
        response,
        "anon_id",
        settings.ANALYTICS_COOKIE_MAX_AGE_DAYS * 86400,
        fallback=ip_hash[:24] if ip_hash else None,
    )
    session_id = _ensure_cookie(
        request,
        response,
        "session_id",
        settings.ANALYTICS_SESSION_MAX_AGE_HOURS * 3600,
    )

    analytics_url = f"{str(settings.ANALYTICS_SERVICE_URL).rstrip('/')}/analytics/events"
    payload = {
        "event_time": datetime.now(timezone.utc).isoformat(),
        "event_type": "page_view",
        "user_id": None,
        "anon_id": anon_id,
        "session_id": session_id,
        "path": body.path,
        "method": "GET",
        "status_code": 200,
        "user_agent": user_agent,
        "referrer": body.referrer,
        "ip": client_ip,
        "ip_hash": ip_hash,
        "request_id": request.headers.get("x-request-id") or getattr(request.state, "request_id", None),
        "service": "public-web",
        "is_authenticated": False,
        "meta": {"title": body.title} if body.title else None,
    }

    try:
        await _CLIENT.post(analytics_url, json=payload, headers={"Cache-Control": "no-store"})
    except Exception:
        # Analytics must never break the public site.
        pass

    return response

