from datetime import date
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, literal, select, union_all

from core.db import SessionLocal
from core.config import settings
from models.event import Event
from schemas.event import EventIn, EventOut
from schemas.stats import DailyStatsRow, EventsPage, SummaryStats, TopPathRow, VisitorsPage, VisitorRow
from services.ingest import add_event
from utils.time import range_for_dates

router = APIRouter(prefix="/analytics", tags=["analytics"])

IGNORED_PATHS: tuple[str, ...] = ("/metrics",)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _apply_ignored_paths(query):
    if not IGNORED_PATHS:
        return query
    # Keep events without a path, but drop noisy technical endpoints like /metrics.
    return query.filter((Event.path.is_(None)) | (~Event.path.in_(IGNORED_PATHS)))


@router.get("/health")
async def health():
    return {"status": "ok", "service": "analytics"}


@router.post("/events", response_model=List[EventOut])
def ingest_events(
    payload: Union[EventIn, List[EventIn]],
    db: Session = Depends(get_db),
):
    events = payload if isinstance(payload, list) else [payload]
    created: List[EventOut] = []
    for ev in events:
        event = add_event(db, ev.model_dump())
        created.append(event)
    db.commit()
    return created


@router.get("/stats/summary", response_model=SummaryStats)
def summary_stats(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    event_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    start_utc, end_utc = range_for_dates(from_date, to_date)

    query = db.query(Event).filter(Event.event_time >= start_utc, Event.event_time < end_utc)
    query = _apply_ignored_paths(query)
    if event_type:
        query = query.filter(Event.event_type == event_type)

    total = query.count()
    users = query.with_entities(func.count(func.distinct(Event.user_id))).scalar() or 0
    guest_key = func.coalesce(func.nullif(Event.anon_id, ""), func.nullif(Event.ip_hash, ""))
    guests = (
        query.with_entities(
            func.count(
                func.distinct(
                    case((Event.user_id.is_(None), guest_key))
                )
            )
        ).scalar() or 0
    )
    return SummaryStats(total=int(total), users=int(users), guests=int(guests))


@router.get("/stats/daily", response_model=List[DailyStatsRow])
def daily_stats(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    event_type: Optional[str] = None,
    path_prefix: Optional[str] = None,
    db: Session = Depends(get_db),
):
    start_utc, end_utc = range_for_dates(from_date, to_date)

    day_expr = func.date_trunc("day", func.timezone(settings.TIMEZONE, Event.event_time)).label("day")

    guest_key = func.coalesce(func.nullif(Event.anon_id, ""), func.nullif(Event.ip_hash, ""))
    query = (
        db.query(
            day_expr,
            func.count(Event.id).label("total"),
            func.count(func.distinct(Event.user_id)).label("users"),
            func.count(
                func.distinct(
                    case((Event.user_id.is_(None), guest_key))
                )
            ).label("guests"),
        )
        .filter(Event.event_time >= start_utc, Event.event_time < end_utc)
        .group_by(day_expr)
        .order_by(day_expr.asc())
    )
    query = _apply_ignored_paths(query)

    if event_type:
        query = query.filter(Event.event_type == event_type)
    if path_prefix:
        query = query.filter(Event.path.ilike(f"{path_prefix}%"))

    rows = []
    for day, total, users, guests in query.all():
        rows.append(DailyStatsRow(
            day=day.date(),
            total=int(total or 0),
            users=int(users or 0),
            guests=int(guests or 0),
        ))
    return rows


@router.get("/stats/top-paths", response_model=List[TopPathRow])
def top_paths(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    start_utc, end_utc = range_for_dates(from_date, to_date)

    query = (
        db.query(Event.path, func.count(Event.id).label("count"))
        .filter(Event.event_time >= start_utc, Event.event_time < end_utc)
        .filter(Event.path.isnot(None))
        .filter(~Event.path.in_(IGNORED_PATHS))
        .group_by(Event.path)
        .order_by(func.count(Event.id).desc())
        .limit(limit)
    )

    return [TopPathRow(path=row.path, count=int(row.count)) for row in query.all() if row.path]


@router.get("/stats/events", response_model=EventsPage)
def list_events(
    day: Optional[date] = None,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    who: str = Query("all"),
    event_type: Optional[str] = None,
    path_prefix: Optional[str] = None,
    method: Optional[str] = None,
    status_code: Optional[int] = None,
    user_id: Optional[int] = None,
    anon_id: Optional[str] = None,
    ip: Optional[str] = None,
    request_id: Optional[str] = None,
    service: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0, le=100000),
    db: Session = Depends(get_db),
):
    if who not in ("all", "users", "guests"):
        raise HTTPException(status_code=400, detail="Invalid 'who' (use all|users|guests)")

    start_utc, end_utc = range_for_dates(day, day) if day else range_for_dates(from_date, to_date)

    query = db.query(Event).filter(Event.event_time >= start_utc, Event.event_time < end_utc)
    query = _apply_ignored_paths(query)
    if event_type:
        query = query.filter(Event.event_type == event_type)
    if path_prefix:
        query = query.filter(Event.path.ilike(f"{path_prefix}%"))
    if method:
        query = query.filter(func.lower(Event.method) == method.lower())
    if status_code is not None:
        query = query.filter(Event.status_code == status_code)
    if who == "users":
        query = query.filter(Event.user_id.isnot(None))
    elif who == "guests":
        query = query.filter(Event.user_id.is_(None))
    if user_id is not None:
        query = query.filter(Event.user_id == user_id)
    if anon_id:
        query = query.filter(Event.anon_id == anon_id)
    if ip:
        query = query.filter(Event.ip == ip)
    if request_id:
        query = query.filter(Event.request_id == request_id)
    if service:
        query = query.filter(Event.service == service)

    total = int(query.count())
    items = (
        query.order_by(Event.event_time.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return EventsPage(total=total, items=items)


@router.get("/traffic", response_model=EventsPage)
def traffic(
    day: Optional[date] = None,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    who: str = Query("all"),
    path_prefix: Optional[str] = None,
    method: Optional[str] = None,
    status_code: Optional[int] = None,
    user_id: Optional[int] = None,
    anon_id: Optional[str] = None,
    ip: Optional[str] = None,
    request_id: Optional[str] = None,
    service: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0, le=100000),
    db: Session = Depends(get_db),
):
    return list_events(
        day=day,
        from_date=from_date,
        to_date=to_date,
        who=who,
        event_type="api_request",
        path_prefix=path_prefix,
        method=method,
        status_code=status_code,
        user_id=user_id,
        anon_id=anon_id,
        ip=ip,
        request_id=request_id,
        service=service,
        limit=limit,
        offset=offset,
        db=db,
    )


@router.get("/traffic/{event_id}", response_model=EventOut)
def traffic_event(event_id: int, db: Session = Depends(get_db)):
    ev = db.query(Event).filter(Event.id == event_id, Event.event_type == "api_request").first()
    if not ev:
        raise HTTPException(status_code=404, detail="Not found")
    return ev


@router.get("/stats/visitors", response_model=VisitorsPage)
def visitors_stats(
    day: Optional[date] = None,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    who: str = Query("all"),
    event_type: Optional[str] = None,
    path_prefix: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0, le=100000),
    db: Session = Depends(get_db),
):
    if who not in ("all", "users", "guests"):
        raise HTTPException(status_code=400, detail="Invalid 'who' (use all|users|guests)")

    start_utc, end_utc = range_for_dates(day, day) if day else range_for_dates(from_date, to_date)

    base_filters = [
        Event.event_time >= start_utc,
        Event.event_time < end_utc,
        (Event.path.is_(None)) | (~Event.path.in_(IGNORED_PATHS)),
    ]
    if event_type:
        base_filters.append(Event.event_type == event_type)
    if path_prefix:
        base_filters.append(Event.path.ilike(f"{path_prefix}%"))

    users_sel = (
        select(
            literal("user").label("kind"),
            Event.user_id.label("user_id"),
            literal(None).label("anon_id"),
            literal(None).label("ip"),
            func.count(Event.id).label("events"),
            func.count(func.distinct(Event.session_id)).label("sessions"),
            func.count(func.distinct(Event.path)).label("paths"),
            func.min(Event.event_time).label("first_seen"),
            func.max(Event.event_time).label("last_seen"),
        )
        .where(Event.user_id.isnot(None), *base_filters)
        .group_by(Event.user_id)
    )

    guests_sel = (
        select(
            literal("guest").label("kind"),
            literal(None).label("user_id"),
            Event.anon_id.label("anon_id"),
            Event.ip.label("ip"),
            func.count(Event.id).label("events"),
            func.count(func.distinct(Event.session_id)).label("sessions"),
            func.count(func.distinct(Event.path)).label("paths"),
            func.min(Event.event_time).label("first_seen"),
            func.max(Event.event_time).label("last_seen"),
        )
        .where(Event.user_id.is_(None), *base_filters)
        .group_by(Event.anon_id, Event.ip)
    )

    selects = []
    if who in ("all", "users"):
        selects.append(users_sel)
    if who in ("all", "guests"):
        selects.append(guests_sel)

    if not selects:
        return VisitorsPage(total=0, items=[])

    combined = union_all(*selects).subquery("visitors")
    total = int(db.execute(select(func.count()).select_from(combined)).scalar() or 0)

    rows = db.execute(
        select(combined)
        .order_by(combined.c.last_seen.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    items = [
        VisitorRow(
            kind=str(r.kind),
            user_id=r.user_id,
            anon_id=r.anon_id,
            ip=r.ip,
            events=int(r.events or 0),
            sessions=int(r.sessions or 0),
            paths=int(r.paths or 0),
            first_seen=r.first_seen,
            last_seen=r.last_seen,
        )
        for r in rows
    ]

    return VisitorsPage(total=total, items=items)
