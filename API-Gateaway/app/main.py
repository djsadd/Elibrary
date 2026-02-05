# FastAPI
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
# Apps back
from app.core.config import settings
from app.api.routes import router as api_router
from app.utils.request_id import RequestIDMiddleware
from app.utils.logging import setup_logging
from app.utils.rate_limit import RateLimitMiddleware
from app.utils.analytics import AnalyticsMiddleware
from app.services.proxy import forward
from app.services.auth_guard import auth_required
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="Elib API Gateway", version="0.1.0", redirect_slashes=False)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(RateLimitMiddleware, rate=settings.RATE_LIMIT_RPS, burst=settings.RATE_LIMIT_BURST)
app.add_middleware(
    AnalyticsMiddleware,
    endpoint=str(settings.ANALYTICS_SERVICE_URL),
    skip_paths=settings.ANALYTICS_SKIP_PATHS,
    timeout_s=settings.ANALYTICS_TIMEOUT_S,
    ip_hash_secret=settings.ANALYTICS_IP_HASH_SECRET,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_logging()

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

app.include_router(api_router, prefix="/api")

@app.api_route("/notification", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@app.api_route("/notification/", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def notification_root_proxy(request: Request, _=Depends(auth_required)):
    return await forward(request, settings.NOTIFY_SERVICE_URL, path_suffix="notification/")


@app.api_route("/notification/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@app.api_route("/notification/{path:path}/", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def notification_proxy(path: str, request: Request, _=Depends(auth_required)):
    return await forward(request, settings.NOTIFY_SERVICE_URL, path_suffix=f"notification/{path}")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "api-gateway"}

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        limit_max_request_size=50 * 1024 * 1024  # 50 MB
    )
