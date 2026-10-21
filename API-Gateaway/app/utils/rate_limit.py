import time
import jwt
from app.core.config import settings
from collections import OrderedDict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rate: float = 5.0, burst: int = 10):
        super().__init__(app)
        self.rate = max(rate, 0.1)
        self.burst = max(burst, 1)
        self.buckets = OrderedDict()

    def _key(self, request):
        header = request.headers.get("authorization", "")
        if header.lower().startswith("bearer ") and settings.JWT_SECRET:
            token = header.split(" ", 1)[1].strip()
            if len(token) <= 8192:
                try:
                    claims = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"],
                                        issuer="elibrary-auth", audience="elibrary",
                                        options={"require":["exp", "iat", "sub", "jti", "typ"]})
                    if claims["typ"] == "access" and int(claims["sub"]) > 0:
                        # A stable subject prevents refresh from resetting the bucket.
                        return "user:" + claims["sub"]
                except (jwt.PyJWTError, ValueError, TypeError):
                    pass
        return "ip:" + (request.client.host if request.client else "unknown")

    async def dispatch(self, request, call_next):
        now = time.monotonic()
        key = self._key(request)
        tokens, last = self.buckets.pop(key, (float(self.burst), now))
        tokens = min(self.burst, tokens + max(now - last, 0) * self.rate)
        if tokens < 1:
            self.buckets[key] = (tokens, now)
            return JSONResponse({"detail": "Too Many Requests"}, status_code=429, headers={"Retry-After": "1"})
        self.buckets[key] = (tokens - 1, now)
        while len(self.buckets) > 10000:
            self.buckets.popitem(last=False)
        return await call_next(request)
