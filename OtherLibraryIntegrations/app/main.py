from fastapi import FastAPI
from app.api.routes import router
from app.core.db import Base, engine
from app.models import libtau  # ensure models are registered

app = FastAPI(title="Library Integration Microservice")

app.include_router(router)


@app.on_event("startup")
def create_tables() -> None:
    # Auto-create tables if they don't exist
    Base.metadata.create_all(bind=engine)
