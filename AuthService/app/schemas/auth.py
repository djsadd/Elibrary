from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
from typing import Any, Dict, List, Optional, Literal
from datetime import datetime

class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=12, max_length=1024)
    first_name: Optional[str] = Field(None, max_length=255)
    last_name: Optional[str] = Field(None, max_length=255)


class UpdateProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    first_name: Optional[str] = Field(None, max_length=255)
    last_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    avatar_url: Optional[str] = Field(None, max_length=500)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr


class PasswordResetConfirmRequest(PasswordResetRequest):
    code: str = Field(pattern=r"^[0-9]{6}$")
    new_password: str = Field(min_length=12, max_length=1024)

    @field_validator("new_password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if not (any(c.islower() for c in value) and any(c.isupper() for c in value)
                and any(c.isdigit() for c in value)
                and any(not c.isalnum() and not c.isspace() for c in value)):
            raise ValueError("Password must include lowercase, uppercase, a number and a symbol")
        return value


class UserAccessUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["student", "teacher", "editor", "librarian", "admin"] | None = None
    is_active: bool | None = None


class PlatonusLoginRequest(BaseModel):
    login: str
    password: str = Field(min_length=1, max_length=1024)
    iin: Optional[str] = None
    icNumber: Optional[str] = None
    authForDeductedStudentsAndGraduates: Optional[bool] = False


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # сек для access


class TwoFAChallengeResponse(BaseModel):
    requires_2fa: bool = True
    challenge_id: str
    expires_in: int


class PlatonusLoginResponse(TokenPair):
    role: Optional[str] = None
    info: Dict[str, Any]


class PlatonusEmailRequiredResponse(BaseModel):
    requires_email: bool = True
    challenge_id: str
    existing_email: Optional[EmailStr] = None
    bound_email: Optional[EmailStr] = None
    code_sent: bool = False
    expires_in: Optional[int] = None
    message: str = "Email already registered. Please provide another email and verify it."


class PlatonusEmailRequest(BaseModel):
    challenge_id: str
    email: EmailStr


class PlatonusEmailVerifyRequest(BaseModel):
    challenge_id: str
    email: EmailStr
    code: str


class IntrospectRequest(BaseModel):
    token: str = Field(min_length=1, max_length=8192)


class IntrospectResponse(BaseModel):
    active: bool
    user_id: Optional[int] = None
    roles: List[str] = []
    exp: Optional[int] = None


class IntrospectAnyResponse(BaseModel):
    # For internal/analytics usage: verifies signature but ignores exp and accepts refresh/access.
    active: bool
    user_id: Optional[int] = None
    roles: List[str] = []
    exp: Optional[int] = None
    typ: Optional[str] = None


class UserAdminOut(BaseModel):
    id: int
    email: EmailStr
    iin: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[str] = None
    institution: Optional[str] = None
    faculty: Optional[str] = None
    group_name: Optional[str] = None
    student_id: Optional[str] = None
    subscription_type: Optional[str] = None
    is_active: Optional[bool] = None
    email_verified: Optional[bool] = None
    phone_verified: Optional[bool] = None
    last_login_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    reading_history_count: Optional[int] = None
    subscription_expire_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UsersListResponse(BaseModel):
    items: List[UserAdminOut]
    total: int
    limit: int
    offset: int


class TwoFAVerifyRequest(BaseModel):
    challenge_id: str
    code: str


class TwoFAResendRequest(BaseModel):
    challenge_id: str
