import logging
from fastapi import Request, HTTPException
from app.core.security import get_bearer_token
from app.services.auth_client import introspect

logger = logging.getLogger("auth_guard")

async def auth_required(request: Request):
    # ===== Логируем данные запроса от фронта =====
    try:
        body = await request.body()
        body_str = body.decode("utf-8") if body else None
    except Exception:
        body_str = "<cannot read body>"

    logger.info(
        "Incoming request: %s %s | Query: %s | Headers: %s | Body: %s",
        request.method,
        request.url.path,
        dict(request.query_params),
        dict(request.headers),
        body_str
    )

    # ===== Проверка токена =====
    token = get_bearer_token(request)
    if not token:
        logger.warning("Missing bearer token")
        raise HTTPException(status_code=401, detail="Missing bearer token")

    data = await introspect(token)

    if not data or not data.active:
        logger.warning("Invalid token: %s", data)
        raise HTTPException(status_code=401, detail="Invalid token")

    # ===== Сохраняем пользователя в request.state =====
    # Преобразуем user_id в строку на всякий случай
    user_id = str(data.user_id) if hasattr(data, "user_id") else None
    roles = getattr(data, "roles", [])
    request.state.user = {"user_id": user_id, "roles": roles}

    logger.info("Authenticated user: %s", request.state.user)

    return request.state.user
