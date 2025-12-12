# app/utils/tokens.py
from datetime import datetime, timedelta, timezone
from jose import jwt
from typing import Tuple, Optional
from app.core.config import settings

def _make(payload: dict, delta: timedelta) -> Tuple[str,int]:
    now = datetime.now(timezone.utc)
    exp = now + delta
    to_encode = {**payload, "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
    token = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALG)
    return token, int(exp.timestamp())

def create_access(user_id: int, roles: str) -> Tuple[str,int]:
    return _make({"sub": str(user_id), "roles": roles.split(","), "typ":"access"}, settings.access_delta)

def create_refresh(user_id: int) -> Tuple[str,int]:
    return _make({"sub": str(user_id), "typ":"refresh"}, settings.refresh_delta)

def decode(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALG])
    except Exception:
        return None
