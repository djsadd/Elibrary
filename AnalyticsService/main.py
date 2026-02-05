from fastapi import FastAPI
from api import router as api_router
from core.clickhouse import ensure_schema
from core.ensure_db import ensure_database_exists
from core.migrate import run_migrations
from prometheus_fastapi_instrumentator import Instrumentator
from utils.logging_config import setup_logging

setup_logging()

app = FastAPI(title="Analytics Service")

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.on_event("startup")
def startup() -> None:
    ensure_database_exists()
    run_migrations()
    try:
        ensure_schema()
    except Exception:
        pass

app.include_router(api_router)
