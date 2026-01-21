from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional
import random
import requests
from app.core.db import SessionLocal
from app.core.config import settings
from app.models.user import User
from typing import Union

from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    PlatonusLoginRequest,
    PlatonusLoginResponse,
    TokenPair,
    TwoFAChallengeResponse,
    IntrospectRequest,
    IntrospectResponse,
    UpdateProfileRequest,
    VerifyCodeRequest,
    TwoFAVerifyRequest,
    TwoFAResendRequest,
    UserAdminOut,
    UsersListResponse,
)
from app.utils.security import hash_password, verify_password
from app.utils.tokens import create_access, create_refresh, decode
from app.services.email_sender import send_2fa_code_email, send_activation_code_email
from app.services.twofa import create_challenge, resend_code, verify_code
from app.utils.authz import (
    AuthUser,
    get_current_user,
    get_current_user_from_access_body_optional,
    get_current_user_from_refresh_body,
    require_roles,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


require_admin = require_roles("admin", "librarian")


@router.post("/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    raise HTTPException(409, "Регистрация новых пользователей отключена администратором") 
    if db.query(User).filter_by(email=req.email).first():
        raise HTTPException(409, "Email already exists")

    code = f"{random.randint(0, 999999):06d}"

    u = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        verification_code=code,
        iin=req.iin,
        first_name=req.first_name,
        last_name=req.last_name,
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


def _twofa_required(u: User) -> bool:
    return bool(settings.TWOFA_REQUIRED) or bool(getattr(u, "twofa_enabled", False))


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(email=req.email).first()
    if not u or not verify_password(req.password, u.hashed_password):
        raise HTTPException(401, "Invalid credentials")

    if not u.is_active:
        code = f"{random.randint(0, 999999):06d}"
        u.verification_code = code
        db.commit()
        try:
            send_activation_code_email(to_email=u.email, code=code, ttl_seconds=600)
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Failed to send activation email: {e}")

        return {
            "email": u.email,
            "verification_required": True,
        }

    if _twofa_required(u):
        try:
            challenge_id, code, ttl = create_challenge(user_id=int(u.id))
            send_2fa_code_email(to_email=u.email, code=code, ttl_seconds=int(ttl))
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Failed to start 2FA: {e}")

        return {"requires_2fa": True, "challenge_id": challenge_id, "expires_in": int(ttl)}

    access, exp = create_access(u.id, u.role or "")
    refresh, _ = create_refresh(u.id)
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=int(exp - __import__("time").time()),
    )


@router.post("/platonus", response_model=Union[PlatonusLoginResponse, TwoFAChallengeResponse])
def platonus_login(req: PlatonusLoginRequest, db: Session = Depends(get_db)):
    try:
        response = requests.post(
            settings.PLATONUS_AUTH_URL,
            json={"username": req.login, "password": req.password},
            timeout=60,
        )
    except requests.RequestException:
        raise HTTPException(502, "Platonus auth service unavailable")

    if response.status_code != 200:
        detail = "Platonus auth failed"
        try:
            detail = response.json().get("detail", detail)
        except ValueError:
            detail = response.text or detail
        raise HTTPException(response.status_code, detail)

    data = response.json()
    info = data.get("info") or data.get("student_info")
    role = data.get("role")
    if not info:
        raise HTTPException(502, "Invalid response from Platonus auth")

    desired_role = None
    if role in {"преподаватель", "библиотека"}:
        employee = info.get("employee") or info.get("person") or {}
        iin = employee.get("iin") or info.get("iin")
        corporate_email = (
            employee.get("mail")
            or employee.get("email")
            or employee.get("corporateEmail")
            or info.get("mail")
            or info.get("email")
        )
        first_name = (
            employee.get("firstname")
            or employee.get("first_name")
            or info.get("firstname")
            or info.get("first_name")
        )
        last_name = (
            employee.get("lastname")
            or employee.get("last_name")
            or info.get("lastname")
            or info.get("last_name")
        )
        if role == "библиотека":
            desired_role = "librarian"
        elif role == "преподаватель":
            desired_role = "teacher"
    else:
        student = info.get("student") or {}
        iin = student.get("iin") or info.get("iin")
        corporate_email = student.get("mail") or info.get("mail")
        first_name = (
            student.get("firstname")
            or student.get("first_name")
            or info.get("firstname")
            or info.get("first_name")
        )
        last_name = (
            student.get("lastname")
            or student.get("last_name")
            or info.get("lastname")
            or info.get("last_name")
        )
    missing_fields = []
    if not iin:
        missing_fields.append("iin")
    if not corporate_email:
        missing_fields.append("email")
    if missing_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Platonus auth missing fields: {', '.join(missing_fields)}",
        )

    u = db.query(User).filter_by(iin=iin).first()
    if not u:

        u = User(
            email=corporate_email,
            hashed_password=hash_password(req.password),
            iin=iin,
            is_active=True,
            role=desired_role or "student",
            first_name=first_name,
            last_name=last_name,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
    elif not u.is_active:
        u.is_active = True
        db.commit()
        db.refresh(u)
    if desired_role:
        current_role = (u.role or "").strip().lower()
        if not current_role or current_role == "student" or (current_role == "teacher" and desired_role == "librarian"):
            u.role = desired_role
            db.commit()
            db.refresh(u)
    # backfill missing names from Platonus
    if u and (first_name or last_name):
        changed = False
        if first_name and not u.first_name:
            u.first_name = first_name
            changed = True
        if last_name and not u.last_name:
            u.last_name = last_name
            changed = True
        if changed:
            db.commit()
            db.refresh(u)

    if _twofa_required(u):
        try:
            challenge_id, code, ttl = create_challenge(user_id=int(u.id))
            send_2fa_code_email(to_email=u.email, code=code, ttl_seconds=int(ttl))
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Failed to start 2FA: {e}")
        return {"requires_2fa": True, "challenge_id": challenge_id, "expires_in": int(ttl)}

    access, exp = create_access(u.id, u.role or "")
    refresh, _ = create_refresh(u.id)
    return PlatonusLoginResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=int(exp - __import__("time").time()),
        role=role,
        info=info,
    )


@router.post("/refresh", response_model=TokenPair)
def refresh_token(
    body: IntrospectRequest,
    user: AuthUser = Depends(get_current_user_from_refresh_body),
    db: Session = Depends(get_db),
):
    u = db.get(User, int(user.user_id))
    if not u:
        raise HTTPException(404, "User not found")

    access, exp = create_access(u.id, u.role or "")
    new_refresh, _ = create_refresh(u.id)
    return TokenPair(
        access_token=access,
        refresh_token=new_refresh,
        expires_in=int(exp - __import__("time").time())
    )


@router.post("/introspect", response_model=IntrospectResponse)
def introspect(body: IntrospectRequest, user: AuthUser | None = Depends(get_current_user_from_access_body_optional)):
    data = decode(body.token)
    if not data or data.get("typ") != "access" or not user:
        return IntrospectResponse(active=False)
    return IntrospectResponse(
        active=True,
        user_id=int(data["sub"]),
        roles=data.get("roles", []),
        exp=data.get("exp"),
    )


@router.get("/me")
def me(user: AuthUser = Depends(get_current_user)):
    return {"user_id": int(user.user_id), "roles": user.roles}


@router.put("/profile")
def update_profile(req: UpdateProfileRequest, user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    u = db.get(User, int(user.user_id))
    if not u:
        raise HTTPException(404, "User not found")

    for field, value in req.dict(exclude_unset=True).items():
        setattr(u, field, value)

    db.commit()
    db.refresh(u)

    return {"message": "Profile updated successfully"}


@router.get("/profile")
def get_profile(user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    u = db.get(User, int(user.user_id))
    if not u:
        raise HTTPException(404, "User not found")

    return {
        "id": u.id,
        "email": u.email,
        "iin": u.iin,
        "first_name": u.first_name,
        "last_name": u.last_name,
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


@router.get("/users", response_model=UsersListResponse)
def list_users(
    _: AuthUser = Depends(require_admin),
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)
    query = db.query(User)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                User.email.ilike(like),
                User.iin.ilike(like),
                User.role.ilike(like),
                User.institution.ilike(like),
                User.faculty.ilike(like),
                User.group_name.ilike(like),
            )
        )
    total = query.count()
    users = (
        query.order_by(User.id.desc())
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )
    items = [
        UserAdminOut(
            id=u.id,
            email=u.email,
            iin=u.iin,
            first_name=u.first_name,
            last_name=u.last_name,
            phone=u.phone,
            role=u.role,
            permissions=u.permissions,
            institution=u.institution,
            faculty=u.faculty,
            group_name=u.group_name,
            subscription_type=u.subscription_type,
            is_active=u.is_active,
            created_at=u.created_at if hasattr(u, "created_at") else None,
        )
        for u in users
    ]
    return UsersListResponse(
        items=items,
        total=total,
        limit=safe_limit,
        offset=safe_offset,
    )


@router.get("/admin/stats")
def admin_stats(
    _: AuthUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    inactive_users = db.query(func.count(User.id)).filter(User.is_active.is_(False)).scalar() or 0
    roles_rows = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    roles = {str(role or "unknown"): int(count) for role, count in roles_rows}
    return {
        "total_users": int(total_users),
        "active_users": int(active_users),
        "inactive_users": int(inactive_users),
        "roles": roles,
    }


@router.post("/2fa/verify", response_model=TokenPair)
def twofa_verify(body: TwoFAVerifyRequest, db: Session = Depends(get_db)):
    try:
        user_id = verify_code(challenge_id=body.challenge_id, code=body.code)
    except ValueError as e:
        msg = str(e) or "Invalid code"
        if msg in {"Too many attempts"}:
            raise HTTPException(status_code=429, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"2FA unavailable: {e}")

    u = db.get(User, int(user_id))
    if not u or not u.is_active:
        raise HTTPException(401, "Invalid credentials")

    access, exp = create_access(u.id, u.role or "")
    refresh, _ = create_refresh(u.id)
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=int(exp - __import__("time").time()),
    )


@router.post("/2fa/resend")
def twofa_resend(body: TwoFAResendRequest, db: Session = Depends(get_db)):
    try:
        user_id, code, ttl = resend_code(challenge_id=body.challenge_id)
    except PermissionError as e:
        try:
            retry_after = int(str(e))
        except Exception:
            retry_after = int(settings.TWOFA_RESEND_COOLDOWN_SECONDS)
        raise HTTPException(status_code=429, detail="Too many requests", headers={"Retry-After": str(retry_after)})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e) or "Invalid challenge")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"2FA unavailable: {e}")

    u = db.get(User, int(user_id))
    if not u:
        raise HTTPException(404, "User not found")

    try:
        send_2fa_code_email(to_email=u.email, code=code, ttl_seconds=int(ttl))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to send 2FA email: {e}")

    return {"ok": True, "expires_in": int(ttl)}


@router.get("/users/{user_id}", response_model=UserAdminOut)
def get_user_admin(
    user_id: int,
    _: AuthUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    return UserAdminOut(
        id=u.id,
        email=u.email,
        iin=u.iin,
        first_name=u.first_name,
        last_name=u.last_name,
        phone=u.phone,
        avatar_url=u.avatar_url,
        role=u.role,
        permissions=u.permissions,
        institution=u.institution,
        faculty=u.faculty,
        group_name=u.group_name,
        student_id=u.student_id,
        subscription_type=u.subscription_type,
        subscription_expire_at=u.subscription_expire_at,
        is_active=u.is_active,
        email_verified=u.email_verified,
        phone_verified=u.phone_verified,
        last_login_at=u.last_login_at,
        last_activity_at=u.last_activity_at,
        reading_history_count=u.reading_history_count,
        created_at=u.created_at if hasattr(u, "created_at") else None,
        updated_at=u.updated_at if hasattr(u, "updated_at") else None,
    )
