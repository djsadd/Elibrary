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

    CORS_ALLOW_ORIGINS: List[str] = ["*"]

    PROXY_TIMEOUT_S: float = 8.0
    PROXY_RETRIES: int = 2
    PROXY_RETRY_BACKOFF_S: float = 0.3

    @field_validator("CORS_ALLOW_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


settings = Settings()
