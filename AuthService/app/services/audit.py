from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any

from fastapi import Request


_logger = logging.getLogger("auth.audit")
if not _logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setLevel(logging.INFO)
    _logger.setLevel(logging.INFO)
    _logger.addHandler(_handler)
    _logger.propagate = False


def audit_event(
    event: str,
    request: Request,
    *,
    actor_user_id: int | None = None,
    actor_email: str | None = None,
    target_user_id: int | None = None,
    target_email: str | None = None,
    success: bool | None = None,
    reason: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    try:
        request_id = request.headers.get("X-Request-Id") or request.headers.get("X-Request-ID") or ""
        if not request_id:
            request_id = uuid.uuid4().hex

        payload: dict[str, Any] = {
            "ts": int(time.time()),
            "event": str(event),
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "ip": getattr(getattr(request, "client", None), "host", None),
            "user_agent": request.headers.get("User-Agent"),
        }
        if actor_user_id is not None:
            payload["actor_user_id"] = int(actor_user_id)
        if actor_email:
            payload["actor_email"] = str(actor_email)
        if target_user_id is not None:
            payload["target_user_id"] = int(target_user_id)
        if target_email:
            payload["target_email"] = str(target_email)
        if success is not None:
            payload["success"] = bool(success)
        if reason:
            payload["reason"] = str(reason)
        if extra:
            payload["extra"] = extra

        _logger.info(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    except Exception:
        # Never break auth flow due to audit logging issues
        return

