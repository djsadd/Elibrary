from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import random
import requests
from app.core.db import SessionLocal
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenPair,
    IntrospectRequest,
    IntrospectResponse,
    UpdateProfileRequest,
    VerifyCodeRequest,
)
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
    if db.query(User).filter_by(email=req.email).first():
        raise HTTPException(409, "Email already exists")

    code = f"{random.randint(0, 999999):06d}"

    u = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        verification_code=code,
        iin=req.iin,
        phone=req.phone,
        avatar_url=req.avatar_url,
        role=req.role,
        permissions=req.permissions,
        institution=req.institution,
        faculty=req.faculty,
        group_name=req.group_name,
        subscription_type=req.subscription_type,
        subscription_expire_at=req.subscription_expire_at,
        google_id=req.google_id,
        github_id=req.github_id,
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    payload = {
        "iin": u.iin,
        "code": code,
        "username": u.email,
        "password": req.password,
    }
    try:
        requests.post(
            "http://192.168.115.29:8015/notifications/",
            json=payload,
            timeout=5,
        )
    except Exception:
        # Не прерываем регистрацию при ошибке уведомления
        pass

    return {
        "id": u.id,
        "email": u.email,
        "verification_required": True,
    }


@router.post("/verify", response_model=TokenPair)
def verify(req: VerifyCodeRequest, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(email=req.email).first()
    if not u:
        raise HTTPException(404, "User not found")
    if u.verification_code != req.code:
        raise HTTPException(400, "Invalid verification code")

    u.verification_code = None
    u.is_active = True
    db.commit()
    db.refresh(u)

    access, exp = create_access(u.id, u.role or "")
    refresh, _ = create_refresh(u.id)
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=int(exp - __import__("time").time()),
    )


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(email=req.email).first()
    if not u or not verify_password(req.password, u.hashed_password):
        raise HTTPException(401, "Invalid credentials")

    if not u.is_active:
        code = f"{random.randint(0, 999999):06d}"
        u.verification_code = code
        db.commit()

        payload = {
            "iin": u.iin,
            "code": code,
            "username": u.email,
            "password": req.password,
        }
        try:
            requests.post(
                "http://192.168.115.29:8015/notifications/",
                json=payload,
                timeout=5,
            )
        except Exception:
            pass

        return {
            "email": u.email,
            "verification_required": True,
        }

    access, exp = create_access(u.id, u.role or "")
    refresh, _ = create_refresh(u.id)
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=int(exp - __import__("time").time()),
    )


@router.post("/refresh", response_model=TokenPair)
def refresh_token(body: IntrospectRequest, db: Session = Depends(get_db)):
    data = decode(body.token)
    if not data or data.get("typ") != "refresh":
        raise HTTPException(401, "Invalid refresh")
    user_id = int(data["sub"])
    u = db.get(User, user_id)

    access, exp = create_access(u.id, u.role or "")
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


@router.put("/profile")
def update_profile(req: UpdateProfileRequest, request: Request, db: Session = Depends(get_db)):
    auth = request.headers.get("authorization", "")
    tok = auth.split(" ", 1)[1] if auth.lower().startswith("bearer ") else None
    data = decode(tok) if tok else None
    if not data:
        raise HTTPException(401, "Invalid token")

    user_id = int(data["sub"])
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")

    for field, value in req.dict(exclude_unset=True).items():
        setattr(u, field, value)

    db.commit()
    db.refresh(u)

    return {"message": "Profile updated successfully"}


@router.get("/profile")
def get_profile(request: Request, db: Session = Depends(get_db)):
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
        "iin": u.iin,
        "phone": u.phone,
        "avatar_url": u.avatar_url,
        "role": u.role,
        "permissions": u.permissions,
        "institution": u.institution,
        "faculty": u.faculty,
        "group_name": u.group_name,
        "subscription_type": u.subscription_type,
        "subscription_expire_at": u.subscription_expire_at,
        "google_id": u.google_id,
        "github_id": u.github_id,
        "created_at": u.created_at if hasattr(u, "created_at") else None,
    }
