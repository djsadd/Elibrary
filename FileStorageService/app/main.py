from fastapi import FastAPI
from app.api.routes_files import router as files_router
from app.utils.logging_config import setup_logging
from prometheus_fastapi_instrumentator import Instrumentator

setup_logging()

app = FastAPI(title="File Storage Service")

app.include_router(files_router)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

@app.get("/")
def root():
    return {"service": "File Storage", "status": "running"}
