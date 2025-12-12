from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    LIB_TAU_HOST: str = "192.168.115.163"
    LIB_TAU_PORT: int = 8074
    LIB_TAU_PORT_SUBJECTS: int = 8074
    LIB_TAU_USER: str = "admin"
    LIB_TAU_PASSWORD: str = "secret123"

    CATALOG_SERVICE_URL: AnyHttpUrl = "http://localhost:8002"
    AUTH_SERVICE_URL: str = "http://localhost:8000/api/"

    # OpenAI / LLM
    OPENAI_API_KEY: str | None = None

    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'library.db'}"
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")


settings = Settings()
