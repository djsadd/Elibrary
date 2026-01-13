from fastapi import FastAPI
from api import router as api_router
from core.clickhouse import ensure_schema
from core.ensure_db import ensure_database_exists
from core.migrate import run_migrations

app = FastAPI(title="Analytics Service")


@app.on_event("startup")
def startup() -> None:
    ensure_database_exists()
    run_migrations()
    ensure_schema()

app.include_router(api_router)
