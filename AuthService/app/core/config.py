from pydantic_settings import BaseSettings
from datetime import timedelta
from pydantic import field_validator


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
    JWT_SECRET_KEY: str
    JWT_ALG: str = "HS256"
    ACCESS_EXPIRES_MIN: int = 30
    REFRESH_EXPIRES_DAYS: int = 30
    # Platonus REST API (external)
    # Used for /auth/platonus login flow
    PLATONUS_AUTH_URL: str = "https://platonus.tau-edu.kz/rest/api/login"

    # Auth abuse protection (rate limits / lockouts / step-up)
    AUTH_TRUST_PROXY_HEADERS: bool = False
    AUTH_FAIL_CLOSED_ON_REDIS: bool = True
    INTERNAL_API_TOKEN: str = ""

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

    # Email password recovery uses separate, short-lived, single-use challenges.
    PASSWORD_RESET_TTL_SECONDS: int = 600
    PASSWORD_RESET_MAX_ATTEMPTS: int = 5
    PASSWORD_RESET_REQUEST_IP_LIMIT: int = 10
    PASSWORD_RESET_REQUEST_EMAIL_LIMIT: int = 3
    PASSWORD_RESET_REQUEST_WINDOW_SECONDS: int = 3600
    PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: int = 60
    PASSWORD_RESET_CONFIRM_IP_LIMIT: int = 20
    PASSWORD_RESET_CONFIRM_EMAIL_LIMIT: int = 10
    PASSWORD_RESET_CONFIRM_WINDOW_SECONDS: int = 600

    model_config = {"env_file": ".env", "extra": "ignore"}

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_key(cls, value):
        if len(value.encode()) < 32 or value.lower() in {"some-super-secret-key", "change_me"}:
            raise ValueError("JWT_SECRET_KEY must be a random secret of at least 32 bytes")
        return value

    @field_validator("JWT_ALG")
    @classmethod
    def validate_algorithm(cls, value):
        if value != "HS256":
            raise ValueError("Only HS256 is supported by this deployment")
        return value

    @property
    def access_delta(self):
        return timedelta(minutes=self.ACCESS_EXPIRES_MIN)

    @property
    def refresh_delta(self):
        return timedelta(days=self.REFRESH_EXPIRES_DAYS)


settings = Settings()
