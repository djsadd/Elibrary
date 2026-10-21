from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    AUTH_SERVICE_URL: str = "http://auth:8001"
    AI_CHAT_CARD_URL: str = ""
    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()
