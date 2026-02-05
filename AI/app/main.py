from fastapi import FastAPI
from app.routers.external import router as external_router
from app.utils.logging_config import setup_logging
from prometheus_fastapi_instrumentator import Instrumentator

setup_logging()

app = FastAPI()

app.include_router(external_router, prefix="/api")

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

@app.get("/")
def root():
    return {"status": "ok"}
