from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.user import User
from app.schemas.auth import (RegisterRequest, LoginRequest, TokenPair,
                              IntrospectRequest, IntrospectResponse)
from app.utils.security import hash_password, verify_password
from app.utils.tokens import create_access, create_refresh, decode

router = APIRouter(prefix="/auth", tags=["auth"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # временно отключено
    # raise HTTPException(403, "Регистрация пока не разрешена")

    if db.query(User).filter_by(email=req.email).first():
        raise HTTPException(409, "Email already exists")
    u = User(email=req.email, hashed_password=hash_password(req.password))
    db.add(u); db.commit(); db.refresh(u)
    return {"id": u.id, "email": u.email}


@router.post("/login", response_model=TokenPair)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(email=req.email).first()
    if not u or not verify_password(req.password, u.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    access, exp = create_access(u.id, u.role or "")
    refresh, _ = create_refresh(u.id)
    return TokenPair(access_token=access, refresh_token=refresh, expires_in=int(exp - __import__("time").time()))


@router.post("/refresh", response_model=TokenPair)
def refresh_token(body: IntrospectRequest, db: Session = Depends(get_db)):
    data = decode(body.token)
    if not data or data.get("typ") != "refresh":
        raise HTTPException(401, "Invalid refresh")
    user_id = int(data["sub"])
    u = db.get(User, user_id)
    if not u or not u.is_active:
        raise HTTPException(401, "User disabled")
    access, exp = create_access(u.id, u.roles or "")
    new_refresh, _ = create_refresh(u.id)
    return TokenPair(
        access_token=access,
        refresh_token=new_refresh,
        expires_in=int(exp - __import__("time").time())
    )


@router.post("/introspect", response_model=IntrospectResponse)
def introspect(body: IntrospectRequest):
    data = decode(body.token)
    if not data or data.get("typ") != "access":
        return IntrospectResponse(active=False)
    return IntrospectResponse(
        active=True,
        user_id=int(data["sub"]),
        roles=data.get("roles", []),
        exp=data.get("exp"),
    )


@router.get("/me")
def me(request: Request):
    auth = request.headers.get("authorization","")
    tok = auth.split(" ", 1)[1] if auth.lower().startswith("bearer ") else None
    data = decode(tok) if tok else None
    if not data: raise HTTPException(401, "Invalid token")
    return {"user_id": int(data["sub"]), "roles": data.get("roles", [])}


@router.get("/profile")
def me(request: Request, db: Session = Depends(get_db)):
    """
    Возвращает всю информацию о текущем пользователе
    """
    auth = request.headers.get("authorization", "")
    tok = auth.split(" ", 1)[1] if auth.lower().startswith("bearer ") else None
    data = decode(tok) if tok else None
    if not data:
        raise HTTPException(401, "Invalid token")

    user_id = int(data["sub"])
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")

    return {
        "id": u.id,
        "email": u.email,
        "phone": u.phone,
        "avatar_url": u.avatar_url,
        "email_verified": u.email_verified,
        "phone_verified": u.phone_verified,
        "role": u.role,
        "permissions": u.permissions,
        "institution": u.institution,
        "faculty": u.faculty,
        "group_name": u.group_name,
        "student_id": u.student_id,
        "last_login_at": u.last_login_at,
        "last_activity_at": u.last_activity_at,
        "reading_history_count": u.reading_history_count,
        "subscription_type": u.subscription_type,
        "subscription_expire_at": u.subscription_expire_at,
        "google_id": u.google_id,
        "github_id": u.github_id,
        "created_at": u.created_at,
        "updated_at": u.updated_at,
    }