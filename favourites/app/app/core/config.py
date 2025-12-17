from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "FavouritesService"
    DATABASE_URL: str = ""

    # Сервисы
    CATALOG_SERVICE_URL: str = "http://localhost:8000/api/catalog"
    AUTH_SERVICE_URL: str = "http://localhost:8000/api/auth"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
