from typing import Optional
from fastapi import Request


def get_bearer_token(request: Request) -> Optional[str]:
    h = request.headers.get("Authorization") or request.headers.get("authorization")
    if not h:
        return None
    if not h.lower().startswith("bearer "):
        return None
    return h.split(" ", 1)[1].strip()
