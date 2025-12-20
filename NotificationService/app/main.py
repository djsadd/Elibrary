from fastapi import FastAPI
from app.api.routes import router as notification_router
from app.core.db import Base, engine
from app.models import notification  # noqa: F401

app = FastAPI(title="Notification Service")

app.include_router(notification_router)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
