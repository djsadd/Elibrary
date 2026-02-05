import os
from urllib.parse import urlparse, urlunparse
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator
from typing import List


class Settings(BaseSettings):
    ENV: str = "dev"
    LOG_LEVEL: str = "INFO"

    RATE_LIMIT_RPS: float = 5.0   # запросов в секунду (скользящее окно на IP/токен)
    RATE_LIMIT_BURST: int = 10

    AUTH_SERVICE_URL: AnyHttpUrl = "http://localhost:8001"
    CATALOG_SERVICE_URL: AnyHttpUrl = "http://localhost:8002"
    FILE_SERVICE_URL: AnyHttpUrl = "http://localhost:8003"
    SEARCH_SERVICE_URL: AnyHttpUrl = "http://localhost:8004"
    PROFILE_SERVICE_URL: AnyHttpUrl = "http://localhost:8005"
    NOTIFY_SERVICE_URL: AnyHttpUrl = "http://localhost:8006"
    REVIEW_SERVICE_URL: AnyHttpUrl = "http://localhost:8007"
    FAVOURITES_SERVICE_URL: AnyHttpUrl = "http://localhost:8008"
    LIBTAU_INTEGRATE_SERVICE: AnyHttpUrl = "http://libtau:8009"
    AI_SERVICE_URL: AnyHttpUrl = "http://ai:8010"
    ANALYTICS_SERVICE_URL: AnyHttpUrl = "http://localhost:8011"

    CORS_ALLOW_ORIGINS: List[str] = ["*"]

    PROXY_TIMEOUT_S: float = 500.0
    PROXY_RETRIES: int = 2
    PROXY_RETRY_BACKOFF_S: float = 0.3
    JWT_SECRET: str = "some-super-secret-key"

    ANALYTICS_ENABLED: bool = True
    ANALYTICS_TIMEOUT_S: float = 0.2
    ANALYTICS_SKIP_PATHS: List[str] = [
        "/health",
        "/docs",
        "/openapi.json",
        "/metrics",
        "/analytics",
        "/api/analytics",
        "/api/public/track",
        "/api/auth/introspect",
    ]
    ANALYTICS_COOKIE_MAX_AGE_DAYS: int = 365
    ANALYTICS_SESSION_MAX_AGE_HOURS: int = 24
    ANALYTICS_IP_HASH_SECRET: str = "change-me"
    ANALYTICS_CAPTURE_BODY: bool = True
    ANALYTICS_MAX_BODY_BYTES: int = 8192
    ANALYTICS_REDACT_KEYS: List[str] = [
        "password",
        "pass",
        "pwd",
        "secret",
        "token",
        "access_token",
        "refresh_token",
        "authorization",
        "cookie",
    ]

    @field_validator("CORS_ALLOW_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @field_validator("ANALYTICS_SERVICE_URL")
    @classmethod
    def normalize_analytics_url(cls, v):
        if not os.path.exists("/.dockerenv"):
            return v
        raw = str(v)
        parsed = urlparse(raw)
        if parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
            netloc = f"analytics:{parsed.port}" if parsed.port else "analytics"
            return urlunparse(parsed._replace(netloc=netloc))
        return v


settings = Settings()
