"""Bound request memory/disk use even when Content-Length is absent or false."""
import json
import asyncio
import os
import tempfile


class RequestLimitsMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")
        headers = dict(scope.get("headers", []))
        upload = path.rstrip("/").endswith(("/upload/raw", "/files/upload"))
        limit = int(os.getenv("MAX_UPLOAD_MB", "200") if upload else os.getenv("MAX_REQUEST_MB", "2")) * 1024 * 1024

        async def reject(status, detail):
            body = json.dumps({"detail": detail}).encode()
            await send({"type": "http.response.start", "status": status,
                        "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()),
                                    (b"x-content-type-options", b"nosniff")]})
            await send({"type": "http.response.body", "body": body})

        if b"content-length" in headers:
            try:
                length = int(headers[b"content-length"])
                if length < 0:
                    raise ValueError()
            except ValueError:
                return await reject(400, "Invalid Content-Length")
            if length > limit:
                return await reject(413, "Request too large")

        async def secured_send(message):
            if message["type"] == "http.response.start":
                message = dict(message)
                items = list(message.get("headers", []))
                items.append((b"x-content-type-options", b"nosniff"))
                items.append((b"referrer-policy", b"same-origin"))
                if "/auth" in path:
                    items = [(key, value) for key, value in items if key.lower() != b"cache-control"]
                    items.append((b"cache-control", b"no-store"))
                message["headers"] = items
            await send(message)

        # Spooling avoids retaining a 200 MB upload in memory. The file is always closed.
        with tempfile.SpooledTemporaryFile(max_size=1024 * 1024) as body:
            total = 0
            while True:
                try:
                    message = await asyncio.wait_for(receive(), timeout=30)
                except TimeoutError:
                    return await reject(408, "Request body timeout")
                if message["type"] == "http.disconnect":
                    return
                chunk = message.get("body", b"")
                total += len(chunk)
                if total > limit:
                    return await reject(413, "Request too large")
                body.write(chunk)
                if not message.get("more_body", False):
                    break
            body.seek(0)
            remaining = total
            complete = False
            async def replay():
                nonlocal remaining, complete
                if complete:
                    return await receive()
                data = body.read(64 * 1024)
                remaining -= len(data)
                complete = remaining == 0
                return {"type": "http.request", "body": data, "more_body": not complete}
            return await self.app(scope, replay, secured_send)
