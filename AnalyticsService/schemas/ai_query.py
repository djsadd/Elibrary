from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class AiQueryIn(BaseModel):
    event_time: Optional[datetime] = None

    user_id: Optional[int] = None
    anon_id: Optional[str] = None
    session_id: Optional[str] = None

    path: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None
    duration_ms: Optional[int] = None

    request_id: Optional[str] = None
    service: Optional[str] = None
    is_authenticated: Optional[bool] = None

    provider: Optional[str] = Field(default=None, max_length=64)
    model: Optional[str] = Field(default=None, max_length=128)

    query_text: Optional[str] = None
    query_hash: Optional[str] = Field(default=None, max_length=64)
    query_len: Optional[int] = None

    meta: Optional[dict[str, Any]] = None


class AiQueryOut(AiQueryIn):
    id: int
    event_time: datetime

    class Config:
        from_attributes = True
