from pydantic_settings import BaseSettings
from datetime import timedelta


class Settings(BaseSettings):
    # DB / Redis
    DATABASE_URL: str = ""
    REDIS_URL: str = "redis://localhost:6379/0"

    # SMTP (email)
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    # JWT
    JWT_SECRET_KEY: str = "CHANGE_ME"
    JWT_ALG: str = "HS256"
    ACCESS_EXPIRES_MIN: int = 30
    REFRESH_EXPIRES_DAYS: int = 30
    PLATONUS_AUTH_URL: str = "http://platonusauth:8013/auth_platonus"

    # Auth abuse protection (rate limits / lockouts / step-up)
    AUTH_TRUST_PROXY_HEADERS: bool = True
    AUTH_FAIL_CLOSED_ON_REDIS: bool = False

    AUTH_RL_LOGIN_IP_LIMIT: int = 20
    AUTH_RL_LOGIN_IP_WINDOW_SECONDS: int = 60
    AUTH_RL_LOGIN_EMAIL_LIMIT: int = 10
    AUTH_RL_LOGIN_EMAIL_WINDOW_SECONDS: int = 300

    AUTH_RL_REGISTER_IP_LIMIT: int = 5
    AUTH_RL_REGISTER_IP_WINDOW_SECONDS: int = 300
    AUTH_RL_VERIFY_IP_LIMIT: int = 10
    AUTH_RL_VERIFY_IP_WINDOW_SECONDS: int = 300

    AUTH_RL_2FA_VERIFY_IP_LIMIT: int = 20
    AUTH_RL_2FA_VERIFY_IP_WINDOW_SECONDS: int = 300
    AUTH_RL_2FA_RESEND_IP_LIMIT: int = 10
    AUTH_RL_2FA_RESEND_IP_WINDOW_SECONDS: int = 300

    AUTH_LOCKOUT_THRESHOLD_EMAIL: int = 10
    AUTH_LOCKOUT_THRESHOLD_IP: int = 40
    AUTH_LOCKOUT_WINDOW_SECONDS: int = 900
    AUTH_LOCKOUT_DURATION_SECONDS: int = 900

    AUTH_STEPUP_THRESHOLD_EMAIL: int = 5
    AUTH_STEPUP_THRESHOLD_IP: int = 20
    AUTH_STEPUP_ON_NEW_IP: bool = True
    AUTH_KNOWN_IP_TTL_SECONDS: int = 7_776_000  # 90 days

    # 2FA (email OTP)
    TWOFA_REQUIRED: bool = False  # if True, require 2FA for all active users
    TWOFA_CODE_LENGTH: int = 6
    TWOFA_TTL_SECONDS: int = 600
    TWOFA_MAX_ATTEMPTS: int = 5
    TWOFA_RESEND_COOLDOWN_SECONDS: int = 30
    TWOFA_CODE_SECRET: str | None = None  # optional; falls back to JWT_SECRET_KEY

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def access_delta(self):
        return timedelta(minutes=self.ACCESS_EXPIRES_MIN)

    @property
    def refresh_delta(self):
        return timedelta(days=self.REFRESH_EXPIRES_DAYS)


settings = Settings()
