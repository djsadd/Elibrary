from fastapi import FastAPI
from api import router as api_router
from core.db import init_db
from core.clickhouse import ensure_schema

app = FastAPI(title="Analytics Service")

init_db()
ensure_schema()

app.include_router(api_router)
