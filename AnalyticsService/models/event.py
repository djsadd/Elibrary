from sqlalchemy import Column, Integer, String, DateTime, func, SmallInteger, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Index
from core.db import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_time: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    user_id: Mapped[int | None] = mapped_column(Integer, index=True)
    anon_id: Mapped[str | None] = mapped_column(String(64), index=True)
    session_id: Mapped[str | None] = mapped_column(String(64), index=True)

    path: Mapped[str | None] = mapped_column(String(512), index=True)
    method: Mapped[str | None] = mapped_column(String(16))
    status_code: Mapped[int | None] = mapped_column(SmallInteger)

    user_agent: Mapped[str | None] = mapped_column(String(512))
    referrer: Mapped[str | None] = mapped_column(String(512))
    ip: Mapped[str | None] = mapped_column(String(64))
    ip_hash: Mapped[str | None] = mapped_column(String(128))

    request_id: Mapped[str | None] = mapped_column(String(64), index=True)
    service: Mapped[str | None] = mapped_column(String(64))
    is_authenticated: Mapped[bool] = mapped_column(Boolean, default=False)

    meta: Mapped[dict | None] = mapped_column(JSONB)


Index("ix_events_time_type", Event.event_time, Event.event_type)
