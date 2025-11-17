# FastAPI
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
# Apps back
from app.core.config import settings
from app.api.routes import router as api_router
from app.utils.request_id import RequestIDMiddleware
from app.utils.logging import setup_logging
from app.utils.rate_limit import RateLimitMiddleware

app = FastAPI(title="Elib API Gateway", version="0.1.0", redirect_slashes=False)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(RateLimitMiddleware, rate=settings.RATE_LIMIT_RPS, burst=settings.RATE_LIMIT_BURST)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_logging()

app.include_router(api_router, prefix="/api")


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