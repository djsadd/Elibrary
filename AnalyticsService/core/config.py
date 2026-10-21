import os
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    ENV: str = "dev"
    LOG_LEVEL: str = "INFO"

    AUTH_SERVICE_URL: str = "http://auth:8001"
    INTERNAL_API_TOKEN: str = ""

    DATABASE_URL: str = Field(...)
    CLICKHOUSE_URL: str = Field("http://localhost:8123")
    CLICKHOUSE_DATABASE: str = "analytics"
    CLICKHOUSE_ENABLED: bool = True

    TIMEZONE: str = "Asia/Almaty"
    IP_HASH_SECRET: str = ""

    EVENT_RETENTION_DAYS: int = 180

    class Config:
        env_file = ".env"
        case_sensitive = False

    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if os.path.exists("/.dockerenv"):
            url = make_url(value)
            if url.host in {"localhost", "127.0.0.1", "::1"}:
                url = url.set(host="postgres")
                return url.render_as_string(hide_password=False)
        return value


settings = Settings()
