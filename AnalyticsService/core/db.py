from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.exc import OperationalError
import time

from core.config import settings

engine = create_engine(settings.DATABASE_URL, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def wait_for_db(max_tries: int = 20, delay_seconds: float = 1.5) -> None:
    for attempt in range(max_tries):
        try:
            with engine.connect():
                return
        except OperationalError:
            if attempt >= max_tries - 1:
                raise
            time.sleep(delay_seconds)


def init_db() -> None:
    from models.event import Event  # noqa: F401

    wait_for_db()
    Base.metadata.create_all(bind=engine)
