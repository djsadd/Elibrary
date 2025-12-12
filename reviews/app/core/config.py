from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Reviews Service"
    # Используем SQLite (файл reviews.db в корне проекта)
    DATABASE_URL: str = ""

    AUTH_SERVICE_URL: str = "http://localhost:8000/api/auth"
    CATALOG_SERVICE_URL: str = "http://localhost:8000/api/catalog"
    DEBUG: bool = True

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
