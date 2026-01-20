from datetime import datetime, timezone
from sqlalchemy.orm import Session

from models.event import Event
from core.clickhouse import insert_event
from core.config import settings
from utils.time import get_tz


def _normalize_event_time(dt: datetime | None) -> datetime:
    if not dt:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def add_event(db: Session, payload: dict) -> Event:
    event_time = _normalize_event_time(payload.get("event_time"))
    event = Event(
        event_time=event_time,
        event_type=str(payload.get("event_type") or "api_request"),
        user_id=payload.get("user_id"),
        anon_id=payload.get("anon_id"),
        session_id=payload.get("session_id"),
        path=payload.get("path"),
        method=payload.get("method"),
        status_code=payload.get("status_code"),
        user_agent=payload.get("user_agent"),
        referrer=payload.get("referrer"),
        ip=payload.get("ip"),
        ip_hash=payload.get("ip_hash"),
        request_id=payload.get("request_id"),
        service=payload.get("service"),
        is_authenticated=bool(payload.get("is_authenticated") or False),
        meta=payload.get("meta") or None,
    )
    db.add(event)
    db.flush()

    tz = get_tz()
    event_date = event_time.astimezone(tz).date()
    if settings.CLICKHOUSE_ENABLED:
        insert_event({
            "event_time": event_time.replace(tzinfo=None),
            "event_date": event_date,
            "event_type": event.event_type,
            "user_id": event.user_id,
            "anon_id": event.anon_id,
            "session_id": event.session_id,
            "path": event.path,
            "method": event.method,
            "status_code": event.status_code,
            "user_agent": event.user_agent,
            "referrer": event.referrer,
            "ip": event.ip,
            "ip_hash": event.ip_hash,
            "request_id": event.request_id,
            "service": event.service,
            "is_authenticated": 1 if event.is_authenticated else 0,
            "meta": event.meta,
        })

    return event
