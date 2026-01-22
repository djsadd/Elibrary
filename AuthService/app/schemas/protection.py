from __future__ import annotations

from pydantic import BaseModel
from typing import Any, Literal, Optional, List


LockoutScope = Literal["ip", "email"]


class LockoutItem(BaseModel):
    scope: LockoutScope
    ident: str
    ttl_seconds: int
    reason: Optional[str] = None
    locked_at: Optional[int] = None
    email_failures: Optional[int] = None
    ip_failures: Optional[int] = None
    extra: Optional[dict[str, Any]] = None


class LockoutListResponse(BaseModel):
    items: List[LockoutItem]
    next_cursor: int


class LockoutBanRequest(BaseModel):
    scope: LockoutScope
    ident: str
    duration_seconds: int = 900
    reason: str = "manual"
    extra: Optional[dict[str, Any]] = None

