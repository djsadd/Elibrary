from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Notification Service"
    DATABASE_URL: str = "sqlite:///./notifications.db"

    AUTH_SERVICE_URL: str = "http://127.0.0.1:8000/api/"
    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
