from datetime import date
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from core.db import SessionLocal
from core.config import settings
from models.event import Event
from schemas.event import EventIn, EventOut
from schemas.stats import DailyStatsRow, SummaryStats, TopPathRow
from services.ingest import add_event
from utils.time import range_for_dates

router = APIRouter(prefix="/analytics", tags=["analytics"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
    if event_type:
        query = query.filter(Event.event_type == event_type)

    total = query.count()
    users = query.with_entities(func.count(func.distinct(Event.user_id))).scalar() or 0
    guests = (
        query.with_entities(
            func.count(
                func.distinct(
                    case((Event.user_id.is_(None), Event.anon_id))
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

    query = (
        db.query(
            day_expr,
            func.count(Event.id).label("total"),
            func.count(func.distinct(Event.user_id)).label("users"),
            func.count(
                func.distinct(
                    case((Event.user_id.is_(None), Event.anon_id))
                )
            ).label("guests"),
        )
        .filter(Event.event_time >= start_utc, Event.event_time < end_utc)
        .group_by(day_expr)
        .order_by(day_expr.asc())
    )

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
        .group_by(Event.path)
        .order_by(func.count(Event.id).desc())
        .limit(limit)
    )

    return [TopPathRow(path=row.path, count=int(row.count)) for row in query.all() if row.path]
