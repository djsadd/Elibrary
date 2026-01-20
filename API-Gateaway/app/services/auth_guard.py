import time
import logging
from fastapi import Request, HTTPException
from jose import jwt, JWTError
from app.core.config import settings
from app.services.auth_client import introspect

logger = logging.getLogger("auth_guard")

# Кэш introspect ответов
TOKEN_CACHE = {}
CACHE_TTL = 60  # секунд


async def auth_required(request: Request):
    # ===== Чтение тела запроса (логирование) =====
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

    # ===== Извлекаем токен =====
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")

    token = auth_header.split(" ", 1)[1]

    # ===== 1) Пытаемся декодировать JWT локально =====
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])

        user = {
            "user_id": str(payload.get("sub")),
            "roles": payload.get("roles", []),
        }

        request.state.user = user
        return user

    except JWTError:
        # Переходим к introspect
        pass

    # ===== 2) Проверяем кэш introspect =====
    cached = TOKEN_CACHE.get(token)
    if cached and cached["expires"] > time.time():
        logger.debug("Using cached introspect response")
        request.state.user = cached["user"]
        return cached["user"]

    # ===== 3) Делаем introspect =====
    try:
        data = await introspect(token)
    except Exception as e:
        logger.error("Auth service error: %s", e)

        # Если есть кэш — используем его
        if cached:
            logger.warning("Using cached user because introspect failed")
            request.state.user = cached["user"]
            return cached["user"]

        # Нет кэша → реальная ошибка
        raise HTTPException(503, "Auth service unavailable")

    # ===== 4) Обработка ответа introspect =====
    if hasattr(data, "status_code") and data.status_code == 429:
        logger.warning("Introspect rate-limited")

        if cached:
            logger.info("Using cached authentication data")
            request.state.user = cached["user"]
            return cached["user"]

        raise HTTPException(503, "Auth service rate-limited")

    if not data or not getattr(data, "active", False):
        raise HTTPException(401, "Invalid token")

    user = {
        "user_id": str(data.user_id),
        "roles": data.roles or []
    }

    # ===== 5) Кэшируем ответ =====
    TOKEN_CACHE[token] = {
        "user": user,
        "expires": time.time() + CACHE_TTL
    }

    request.state.user = user
    return user


async def auth_optional(request: Request):
    """
    "Мягкая" аутентификация: если bearer-токен есть и валиден — положит user в request.state.user.
    Если токена нет/он невалиден/интроспект недоступен — НЕ падает 401, а просто возвращает None.
    Нужна для публичных роутов (например, /catalog), чтобы аналитика и прокси-headers
    могли понимать авторизованного пользователя, не блокируя гостей.
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None

    token = auth_header.split(" ", 1)[1]

    # 1) Пытаемся декодировать локально
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user = {
            "user_id": str(payload.get("sub")),
            "roles": payload.get("roles", []),
        }
        request.state.user = user
        return user
    except JWTError:
        pass

    # 2) Кэш introspect
    cached = TOKEN_CACHE.get(token)
    if cached and cached["expires"] > time.time():
        request.state.user = cached["user"]
        return cached["user"]

    # 3) introspect (без исключений наружу)
    try:
        data = await introspect(token)
    except Exception:
        return cached["user"] if cached else None

    if not data or not getattr(data, "active", False):
        return None

    user = {"user_id": str(data.user_id), "roles": data.roles or []}
    TOKEN_CACHE[token] = {"user": user, "expires": time.time() + CACHE_TTL}
    request.state.user = user
    return user
