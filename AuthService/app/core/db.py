from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.exc import OperationalError
import time

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, future=True)
SessionLocal = sessionmaker(engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def wait_for_db(max_tries: int = 20, delay_seconds: float = 1.5) -> None:
    # Retry until DB is reachable to avoid startup race with postgres.
    for attempt in range(max_tries):
        try:
            with engine.connect():
                return
        except OperationalError:
            if attempt >= max_tries - 1:
                raise
            time.sleep(delay_seconds)


def init_db():
    from app.models.user import User  # noqa: F401

    wait_for_db()
    Base.metadata.create_all(bind=engine)