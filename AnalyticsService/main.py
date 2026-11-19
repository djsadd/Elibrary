from utils.request_limits import RequestLimitsMiddleware
from fastapi import FastAPI
from api import router as api_router
from core.clickhouse import ensure_schema
from core.ensure_db import ensure_database_exists
from core.migrate import run_migrations
from prometheus_fastapi_instrumentator import Instrumentator
from utils.logging_config import setup_logging
from core.config import settings
import logging

setup_logging()

app = FastAPI(title="Analytics Service")

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.on_event("startup")
def startup() -> None:
    if len(settings.INTERNAL_API_TOKEN or "") < 32:
        logging.getLogger(__name__).error(
            "INTERNAL_API_TOKEN is missing or shorter than 32 chars: POST /analytics/events rejects every "
            "event and the dashboards show zeros. Set the same value in the gateway env."
        )
    ensure_database_exists()
    run_migrations()
    try:
        ensure_schema()
    except Exception:
        pass

app.include_router(api_router)


app.add_middleware(RequestLimitsMiddleware)
