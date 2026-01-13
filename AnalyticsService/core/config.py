from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    ENV: str = "dev"
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = Field("postgresql+psycopg2://elib:elib@localhost:5432/analytics_db")
    CLICKHOUSE_URL: str = Field("http://localhost:8123")
    CLICKHOUSE_DATABASE: str = "analytics"
    CLICKHOUSE_ENABLED: bool = True

    TIMEZONE: str = "Asia/Almaty"
    IP_HASH_SECRET: str = "change-me"

    EVENT_RETENTION_DAYS: int = 180

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
