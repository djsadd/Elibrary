from fastapi import FastAPI
from app.api.routes import router
from app.core.db import Base, engine
from app.models import libtau  # ensure models are registered
from app.utils.logging_config import setup_logging
from prometheus_fastapi_instrumentator import Instrumentator

setup_logging()

app = FastAPI(title="Library Integration Microservice")

app.include_router(router)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.on_event("startup")
def create_tables() -> None:
    # Auto-create tables if they don't exist
    Base.metadata.create_all(bind=engine)
