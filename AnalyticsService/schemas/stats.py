from datetime import date
from pydantic import BaseModel


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
