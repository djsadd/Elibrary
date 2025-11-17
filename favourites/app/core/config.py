from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "FavouritesService"
    DATABASE_URL: str = "sqlite:///./favourites.db"

    # Сервисы
    CATALOG_SERVICE_URL: str = "http://localhost:8000/api/catalog"
    AUTH_SERVICE_URL: str = "http://localhost:8000/api/auth"

    class Config:
        env_file = ".env"


settings = Settings()
