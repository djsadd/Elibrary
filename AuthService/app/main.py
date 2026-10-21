from app.utils.request_limits import RequestLimitsMiddleware
from fastapi import FastAPI
from app.api.routes import router
from app.api.password_recovery import router as password_recovery_router

from app.core.db import Base, engine
from app.core.db import init_db
from app.utils.logging_config import setup_logging
from prometheus_fastapi_instrumentator import Instrumentator


setup_logging()

app = FastAPI(title="AuthService", version="0.1.0")
app.include_router(router)
app.include_router(password_recovery_router)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


init_db()


@app.get("/health")
def health(): return {"status": "ok", "service": "auth"}


app.add_middleware(RequestLimitsMiddleware)
