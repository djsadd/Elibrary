from fastapi import FastAPI
from app.api.v1 import reviews
from app.core.db import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from app.utils.logging_config import setup_logging
from prometheus_fastapi_instrumentator import Instrumentator


Base.metadata.create_all(bind=engine)

setup_logging()

app = FastAPI(title="Reviews Service")

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # или конкретный фронтенд
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reviews.router)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")
