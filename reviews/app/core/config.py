from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Reviews Service"
    # Используем SQLite (файл reviews.db в корне проекта)
    DATABASE_URL: str = "sqlite:///./reviews.db"

    AUTH_SERVICE_URL: str = "http://localhost:8000/api/auth"
    CATALOG_SERVICE_URL: str = "http://localhost:8000/api/catalog"
    DEBUG: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
