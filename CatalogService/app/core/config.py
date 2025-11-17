from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
import os


class Settings(BaseSettings):
    USE_SQLITE: bool = True

    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 5432
    DB_NAME: str = "catalog_db"
    DB_USER: str = "postgres"
    DB_PASS: str = "postgres"

    SQLITE_DB_PATH: str = "sqlite.db"
    FILE_SERVICE_URL: str = "http://127.0.0.1:8082/files/upload"

    AUTH_SERVICE_URL: str = "http://127.0.0.1:8000/api/"
    # CORS
    CORS_ALLOW_ORIGINS: str = ""

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.USE_SQLITE:
            db_path = os.path.abspath(self.SQLITE_DB_PATH)
            return f"sqlite:///{db_path}"
        return (
            f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASS}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    def cors_origins_list(self) -> list[str]:
        if not self.CORS_ALLOW_ORIGINS:
            return []
        return [o.strip() for o in self.CORS_ALLOW_ORIGINS.split(",") if o.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
