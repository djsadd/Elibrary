from datetime import date
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

from schemas.event import EventOut


class DailyStatsRow(BaseModel):
    day: date
    total: int
    users: int
    guests: int


class SummaryStats(BaseModel):
    total: int
    users: int
    guests: int


class TopPathRow(BaseModel):
    path: str
    count: int


class VisitorRow(BaseModel):
    kind: Literal["user", "guest"]
    user_id: Optional[int] = None
    anon_id: Optional[str] = None
    ip: Optional[str] = None
    events: int
    sessions: int
    paths: int
    first_seen: datetime
    last_seen: datetime


class VisitorsPage(BaseModel):
    total: int
    items: List[VisitorRow]


class EventsPage(BaseModel):
    total: int
    items: List[EventOut]
