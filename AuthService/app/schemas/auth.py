from pydantic import BaseModel, EmailStr
from typing import List, Optional

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # сек для access

class IntrospectRequest(BaseModel):
    token: str

class IntrospectResponse(BaseModel):
    active: bool
    user_id: Optional[int] = None
    roles: List[str] = []
    exp: Optional[int] = None
