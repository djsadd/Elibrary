from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
import os


class Settings(BaseSettings):
    # Прямое подключение к БД из переменной окружения
    DATABASE_URL: str = ""

    # Для обратной совместимости (если DATABASE_URL не задан)
    USE_SQLITE: bool = True
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 5432
    DB_NAME: str = "catalog_db"
    DB_USER: str = "postgres"
    DB_PASS: str = ""
    SQLITE_DB_PATH: str = "sqlite.db"

    FILE_SERVICE_URL: str = "http://127.0.0.1:8082/files/upload"
    AUTH_SERVICE_URL: str = "http://127.0.0.1:8000/api/"
    SEARCH_SERVICE_URL: str = "http://search:8004"
    SEARCH_ADMIN_TOKEN: str = ""

    # CORS (через запятую)
    CORS_ALLOW_ORIGINS: str = ""

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.USE_SQLITE:
            db_path = os.path.abspath(self.SQLITE_DB_PATH)
            return f"sqlite:///{db_path}"
        if not self.DB_PASS:
            raise ValueError("Set DATABASE_URL or DB_PASS for PostgreSQL")
        from sqlalchemy.engine import URL
        return URL.create("postgresql+psycopg2", username=self.DB_USER, password=self.DB_PASS,
                          host=self.DB_HOST, port=self.DB_PORT, database=self.DB_NAME).render_as_string(hide_password=False)

    def cors_origins_list(self) -> list[str]:
        if not self.CORS_ALLOW_ORIGINS:
            return []
        return [o.strip() for o in self.CORS_ALLOW_ORIGINS.split(",") if o.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
