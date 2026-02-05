from fastapi import FastAPI
from app.api.routes import router as notification_router
from app.core.db import Base, engine
from app.models import notification  # noqa: F401
from app.utils.logger import setup_logging
from prometheus_fastapi_instrumentator import Instrumentator

setup_logging()

app = FastAPI(title="Notification Service")

app.include_router(notification_router)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
