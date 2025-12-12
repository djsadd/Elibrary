import time
from collections import defaultdict, deque
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rate: float = 5.0, burst: int = 10):
        super().__init__(app)
        self.rate = rate
        self.burst = burst
        self.buckets = defaultdict(deque)  # key->deque[timestamps]

    def _key(self, request: Request) -> str:
        token = request.headers.get("authorization", "")
        ip = request.client.host if request.client else "unknown"
        return token or ip

    async def dispatch(self, request: Request, call_next):
        key = self._key(request)
        now = time.time()
        window = 1.0  # сек

        q = self.buckets[key]
        while q and now - q[0] > window:
            q.popleft()

        if len(q) >= self.burst:
            return JSONResponse({"detail": "Too Many Requests"}, status_code=429)

        q.append(now)
        return await call_next(request)
