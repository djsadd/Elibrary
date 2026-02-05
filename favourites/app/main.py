from fastapi import FastAPI
from app.api import favourites
from app.core.db import Base, engine
from app.utils.logging_config import setup_logging
from prometheus_fastapi_instrumentator import Instrumentator

setup_logging()

app = FastAPI(title="Favourites Service")

Base.metadata.create_all(bind=engine)

app.include_router(favourites.router, prefix="/favourites")

Instrumentator().instrument(app).expose(app, endpoint="/metrics")
