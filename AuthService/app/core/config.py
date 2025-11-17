from pydantic_settings import BaseSettings
from datetime import timedelta


class Settings(BaseSettings):
    # DB / Redis
    DATABASE_URL: str = ""
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "CHANGE_ME"
    JWT_ALG: str = "HS256"
    ACCESS_EXPIRES_MIN: int = 30
    REFRESH_EXPIRES_DAYS: int = 30

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def access_delta(self):
        return timedelta(minutes=self.ACCESS_EXPIRES_MIN)

    @property
    def refresh_delta(self):
        return timedelta(days=self.REFRESH_EXPIRES_DAYS)


settings = Settings()

