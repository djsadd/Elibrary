import uuid
import re
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, header_name: str = "X-Request-ID"):
        super().__init__(app)
        self.header_name = header_name

    async def dispatch(self, request: Request, call_next):
        req_id = request.headers.get(self.header_name) or str(uuid.uuid4())
        if not re.fullmatch(r"[A-Za-z0-9._-]{1,128}", req_id):
            req_id = str(uuid.uuid4())
        request.state.request_id = req_id
        response: Response = await call_next(request)
        response.headers[self.header_name] = req_id
        return response
