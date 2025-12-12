from typing import List
from pydantic import BaseModel
from fastapi import Depends, HTTPException, Request
import httpx
import json
import logging

from app.core.config import settings

# --- Настройка логгера ---
logger = logging.getLogger("authz")
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s")
handler.setFormatter(formatter)
if not logger.handlers:
    logger.addHandler(handler)
# --------------------------

_INTROSPECT_URL = (str(settings.AUTH_SERVICE_URL).rstrip("/") + "/introspect")
_client = httpx.AsyncClient(timeout=10.0)


class AuthUser(BaseModel):
    user_id: int
    roles: List[str] = []


async def get_current_user(request: Request) -> AuthUser:
    """
    Проверяет токен и возвращает текущего пользователя.
    Дополнительно логирует всё, что пришло от фронтенда.
    """
    # --- Логируем всю информацию о запросе ---
    try:
        body_bytes = await request.body()
        body_text = body_bytes.decode("utf-8") if body_bytes else "(empty)"
    except Exception as e:
        body_text = f"(error reading body: {e})"

    logger.debug("=== Incoming request from frontend ===")
    logger.debug(f"Method: {request.method}")
    logger.debug(f"URL: {request.url}")
    logger.debug(f"Headers: {dict(request.headers)}")
    logger.debug(f"Query params: {dict(request.query_params)}")
    logger.debug(f"Body: {body_text}")
    logger.debug("======================================")

    # --- Извлекаем и проверяем токен ---
    auth = request.headers.get("authorization", "")
    logger.debug(f"Authorization header: {auth}")

    token = auth.split(" ", 1)[1] if auth.lower().startswith("bearer ") else None
    if not token:
        logger.warning("Missing bearer token")
        raise HTTPException(status_code=401, detail="Missing bearer token")

    logger.debug(f"Sending token to introspect: {_INTROSPECT_URL}")

    try:
        resp = await _client.post(_INTROSPECT_URL, json={"token": token})
        logger.debug(f"Introspect response: {resp.status_code}")
        logger.debug(f"Introspect body: {resp.text}")
    except httpx.HTTPError as e:
        logger.error(f"Auth service unavailable: {e}")
        raise HTTPException(status_code=502, detail="Auth service unavailable")

    if resp.status_code != 200:
        logger.warning(f"Invalid token (status {resp.status_code})")
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        data = resp.json()
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON from introspect: {e}")
        raise HTTPException(status_code=502, detail="Auth service returned bad JSON")

    logger.debug(f"Decoded introspect JSON: {data}")

    if not data.get("active"):
        logger.warning("Token inactive")
        raise HTTPException(status_code=401, detail="Token inactive")

    user = AuthUser(
        user_id=int(data.get("user_id", 0)),
        roles=data.get("roles") or []
    )
    logger.info(f"Authenticated user_id={user.user_id}, roles={user.roles}")
    return user


def require_roles(*required: str):
    required_set = {r.lower() for r in required if r}

    async def _checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        logger.debug(f"Checking roles {required_set} for user {user.roles}")
        if not required_set:
            return user
        user_roles = {r.lower() for r in user.roles}
        if user_roles.intersection(required_set):
            logger.info(f"Access granted for user {user.user_id}")
            return user
        logger.warning(f"Access denied for user {user.user_id}: missing roles {required_set}")
        raise HTTPException(status_code=403, detail="Forbidden")
    return _checker
