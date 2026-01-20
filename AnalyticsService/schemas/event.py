from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class EventIn(BaseModel):
    event_time: Optional[datetime] = None
    event_type: str = Field(default="api_request", max_length=64)

    user_id: Optional[int] = None
    anon_id: Optional[str] = None
    session_id: Optional[str] = None

    path: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None

    user_agent: Optional[str] = None
    referrer: Optional[str] = None
    ip: Optional[str] = None
    ip_hash: Optional[str] = None

    request_id: Optional[str] = None
    service: Optional[str] = None
    is_authenticated: Optional[bool] = None

    meta: Optional[dict[str, Any]] = None


class EventOut(EventIn):
    id: int
    event_time: datetime

    class Config:
        from_attributes = True
