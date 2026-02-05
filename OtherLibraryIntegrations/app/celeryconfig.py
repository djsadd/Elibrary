from celery import Celery
from app.core.config import settings
from app.utils.logging_config import setup_logging

setup_logging()

celery = Celery(
    "otherlibraryintegrations",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    worker_hijack_root_logger=False,
)
