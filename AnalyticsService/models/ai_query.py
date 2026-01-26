from sqlalchemy import Boolean, Column, DateTime, Index, Integer, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from core.db import Base


class AiQuery(Base):
    __tablename__ = "ai_queries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_time: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_id: Mapped[int | None] = mapped_column(Integer, index=True)
    anon_id: Mapped[str | None] = mapped_column(String(64), index=True)
    session_id: Mapped[str | None] = mapped_column(String(64), index=True)

    path: Mapped[str | None] = mapped_column(String(512), index=True)
    method: Mapped[str | None] = mapped_column(String(16))
    status_code: Mapped[int | None] = mapped_column(SmallInteger)
    duration_ms: Mapped[int | None] = mapped_column(Integer)

    request_id: Mapped[str | None] = mapped_column(String(64), index=True)
    service: Mapped[str | None] = mapped_column(String(64))
    is_authenticated: Mapped[bool] = mapped_column(Boolean, default=False)

    provider: Mapped[str | None] = mapped_column(String(64))
    model: Mapped[str | None] = mapped_column(String(128))

    query_text: Mapped[str | None] = mapped_column(Text)
    query_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    query_len: Mapped[int | None] = mapped_column(Integer)

    meta: Mapped[dict | None] = mapped_column(JSONB)


Index("ix_ai_queries_time_user", AiQuery.event_time, AiQuery.user_id)
