from pydantic import BaseModel, EmailStr
from typing import Any, Dict, List, Optional
from datetime import datetime

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    iin: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = "student"
    permissions: Optional[str] = None
    institution: Optional[str] = None
    faculty: Optional[str] = None
    group_name: Optional[str] = None
    subscription_type: Optional[str] = "free"
    subscription_expire_at: Optional[datetime] = None
    google_id: Optional[str] = None
    github_id: Optional[str] = None


class UpdateProfileRequest(BaseModel):
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
    subscription_type: Optional[str] = None
    subscription_expire_at: Optional[datetime] = None
    google_id: Optional[str] = None
    github_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PlatonusLoginRequest(BaseModel):
    login: str
    password: str
    iin: Optional[str] = None
    icNumber: Optional[str] = None
    authForDeductedStudentsAndGraduates: Optional[bool] = False


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


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
    message: str = "Email already registered. Please provide another email and verify it."


class PlatonusEmailRequest(BaseModel):
    challenge_id: str
    email: EmailStr


class PlatonusEmailVerifyRequest(BaseModel):
    challenge_id: str
    email: EmailStr
    code: str


class IntrospectRequest(BaseModel):
    token: str


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
