from pydantic import BaseModel, EmailStr
from typing import Any, Dict, List, Optional
from datetime import datetime

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    iin: Optional[str] = None
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


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # сек для access


class PlatonusLoginResponse(TokenPair):
    role: Optional[str] = None
    info: Dict[str, Any]


class IntrospectRequest(BaseModel):
    token: str


class IntrospectResponse(BaseModel):
    active: bool
    user_id: Optional[int] = None
    roles: List[str] = []
    exp: Optional[int] = None
