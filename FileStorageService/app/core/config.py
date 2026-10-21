from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    AUTH_SERVICE_URL: str = "http://auth:8001"
    MAX_UPLOAD_MB: int = 200
    ALLOWED_EXTENSIONS: str = ".pdf,.epub,.djvu,.txt,.png,.jpg,.jpeg,.webp"
    STORAGE_PATH: str = "storage"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
