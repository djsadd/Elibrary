from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional
import logging
import json
import secrets
import random
import requests
from prometheus_client import Counter
from app.core.db import SessionLocal
from app.core.config import settings
from app.models.user import User
from typing import Union

from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    PlatonusLoginRequest,
    PlatonusLoginResponse,
    PlatonusEmailRequiredResponse,
    PlatonusEmailRequest,
    PlatonusEmailVerifyRequest,
    TokenPair,
    TwoFAChallengeResponse,
    IntrospectRequest,
    IntrospectResponse,
    IntrospectAnyResponse,
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
from app.services.audit import audit_event
from app.services import platonus_rest
from app.services.platonus_rest import PlatonusAuthError
from app.services.platonus_email_change import create_challenge as create_email_change_challenge
from app.services.platonus_email_change import request_code as request_email_change_code
from app.services.platonus_email_change import verify_code as verify_email_change_code
from app.services.platonus_email_change import peek_payload as peek_email_change_payload
from app.utils.lang import get_lang
from app.services.security_controls import (
    check_lockout,
    clear_login_failures,
    enforce_rate_limit,
    get_client_ip,
    mark_known_ip,
    register_login_failure,
    should_step_up,
)
from app.schemas.protection import LockoutBanRequest, LockoutItem, LockoutListResponse
from app.utils.authz import (
    AuthUser,
    get_current_user,
    get_current_user_from_access_body_optional,
    get_current_user_from_refresh_body,
    require_roles,
)

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger(__name__)
AUTH_LOGIN_SUCCESS_TOTAL = Counter("auth_login_success_total", "Total successful logins")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


require_admin = require_roles("admin", "librarian")


def _lock_key_prefix(scope: str) -> str:
    if scope == "ip":
        return "auth:login:lock:ip:"
    if scope == "email":
        return "auth:login:lock:email:"
    raise HTTPException(status_code=400, detail="Invalid scope")


def _fail_key_prefix(scope: str) -> str:
    if scope == "ip":
        return "auth:login:fail:ip:"
    if scope == "email":
        return "auth:login:fail:email:"
    raise HTTPException(status_code=400, detail="Invalid scope")


@router.get("/protection/lockouts", response_model=LockoutListResponse, tags=["protection"])
def list_lockouts(
    scope: str = "ip",
    limit: int = 100,
    cursor: int = 0,
    _: AuthUser = Depends(require_admin),
):
    from app.core.redis import r

    if limit < 1:
        limit = 1
    if limit > 500:
        limit = 500

    prefix = _lock_key_prefix(scope)
    match = f"{prefix}*"

    items: list[LockoutItem] = []
    next_cursor = int(cursor or 0)
    while len(items) < limit:
        next_cursor, keys = r.scan(cursor=next_cursor, match=match, count=min(limit, 200))
        if not keys:
            if next_cursor == 0:
                break
            continue

        pipe = r.pipeline()
        for k in keys:
            pipe.ttl(k)
            pipe.get(k)
        results = pipe.execute()

        for i, k in enumerate(keys):
            ttl = int(results[i * 2] or -1)
            raw = results[i * 2 + 1]
            ident = str(k)[len(prefix) :]

            reason = None
            locked_at = None
            email_failures = None
            ip_failures = None
            extra = None
            if raw:
                try:
                    payload = json.loads(raw)
                    reason = payload.get("reason")
                    locked_at = payload.get("locked_at")
                    email_failures = payload.get("email_failures")
                    ip_failures = payload.get("ip_failures")
                    extra = payload.get("extra")
                except Exception:
                    reason = None

            try:
                failures = r.get(f"{_fail_key_prefix(scope)}{ident}")
                if failures is not None:
                    if scope == "email":
                        email_failures = int(failures)
                    else:
                        ip_failures = int(failures)
            except Exception:
                pass

            if ttl > 0:
                items.append(
                    LockoutItem(
                        scope=scope,  # type: ignore[arg-type]
                        ident=ident,
                        ttl_seconds=ttl,
                        reason=reason,
                        locked_at=locked_at,
                        email_failures=email_failures,
                        ip_failures=ip_failures,
                        extra=extra,
                    )
                )
                if len(items) >= limit:
                    break

        if next_cursor == 0:
            break

    return LockoutListResponse(items=items, next_cursor=int(next_cursor))


@router.delete("/protection/lockouts", tags=["protection"])
def clear_lockout(
    scope: str,
    ident: str,
    request: Request,
    _: AuthUser = Depends(require_admin),
):
    from app.core.redis import r

    lock_key = f"{_lock_key_prefix(scope)}{ident}"
    fail_key = f"{_fail_key_prefix(scope)}{ident}"
    r.delete(lock_key, fail_key)
    audit_event("auth.lockout_cleared", request, success=True, reason="admin", extra={"scope": scope, "ident": ident})
    return {"ok": True}


@router.post("/protection/lockouts/ban", tags=["protection"])
def ban_lockout(
    body: LockoutBanRequest,
    request: Request,
    _: AuthUser = Depends(require_admin),
):
    from app.core.redis import r

    ident = body.ident.strip()
    if not ident:
        raise HTTPException(status_code=400, detail="ident is required")
    duration = int(body.duration_seconds or 0)
    if duration < 30:
        duration = 30
    if duration > 60 * 60 * 24 * 30:
        duration = 60 * 60 * 24 * 30

    lock_key = f"{_lock_key_prefix(body.scope)}{ident}"
    payload = {
        "reason": body.reason,
        "locked_at": int(__import__('time').time()),
        "extra": body.extra or None,
    }
    r.setex(lock_key, duration, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    audit_event(
        "auth.lockout_created",
        request,
        success=True,
        reason="manual",
        extra={"scope": body.scope, "ident": ident, "duration_seconds": duration, "lock_reason": body.reason},
    )
    return {"ok": True, "ttl_seconds": duration}


@router.post("/register", status_code=201)
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    enforce_rate_limit(
        action="register",
        scope="ip",
        ident=ip or "unknown",
        limit=int(settings.AUTH_RL_REGISTER_IP_LIMIT),
        window_seconds=int(settings.AUTH_RL_REGISTER_IP_WINDOW_SECONDS),
    )
    audit_event("auth.register_attempt", request, target_email=req.email, extra={"ip": ip})
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
def verify(req: VerifyCodeRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    enforce_rate_limit(
        action="verify",
        scope="ip",
        ident=ip or "unknown",
        limit=int(settings.AUTH_RL_VERIFY_IP_LIMIT),
        window_seconds=int(settings.AUTH_RL_VERIFY_IP_WINDOW_SECONDS),
    )
    audit_event("auth.verify_attempt", request, target_email=req.email, extra={"ip": ip})
    u = db.query(User).filter_by(email=req.email).first()
    if not u:
        audit_event("auth.verify_failed", request, target_email=req.email, success=False, reason="user_not_found")
        raise HTTPException(404, "User not found")
    if u.verification_code != req.code:
        audit_event(
            "auth.verify_failed",
            request,
            target_user_id=u.id,
            target_email=u.email,
            success=False,
            reason="invalid_code",
        )
        raise HTTPException(400, "Invalid verification code")

    u.verification_code = None
    u.is_active = True
    db.commit()
    db.refresh(u)
    audit_event("auth.verify_success", request, target_user_id=u.id, target_email=u.email, success=True, extra={"ip": ip})

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
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    enforce_rate_limit(
        action="login",
        scope="ip",
        ident=ip or "unknown",
        limit=int(settings.AUTH_RL_LOGIN_IP_LIMIT),
        window_seconds=int(settings.AUTH_RL_LOGIN_IP_WINDOW_SECONDS),
    )
    enforce_rate_limit(
        action="login",
        scope="email",
        ident=str(req.email).lower(),
        limit=int(settings.AUTH_RL_LOGIN_EMAIL_LIMIT),
        window_seconds=int(settings.AUTH_RL_LOGIN_EMAIL_WINDOW_SECONDS),
    )

    lock = check_lockout(email=str(req.email), ip=ip)
    if lock.locked:
        audit_event(
            "auth.login_blocked",
            request,
            target_email=req.email,
            success=False,
            reason="lockout",
            extra={"retry_after": lock.retry_after, "ip": ip},
        )
        raise HTTPException(status_code=429, detail="Too many attempts", headers={"Retry-After": str(lock.retry_after)})

    audit_event("auth.login_attempt", request, target_email=req.email, extra={"ip": ip})

    u = db.query(User).filter_by(email=req.email).first()
    if not u or not verify_password(req.password, u.hashed_password):
        upd = register_login_failure(email=str(req.email), ip=ip)
        audit_event(
            "auth.login_failed",
            request,
            target_email=req.email,
            success=False,
            reason="invalid_credentials",
            extra={
                "ip": ip,
                "email_failures": upd.email_failures,
                "ip_failures": upd.ip_failures,
                "locked": upd.locked,
            },
        )
        if upd.locked:
            raise HTTPException(
                status_code=429,
                detail="Too many attempts",
                headers={"Retry-After": str(int(upd.retry_after or settings.AUTH_LOCKOUT_DURATION_SECONDS))},
            )
        raise HTTPException(401, "Invalid credentials")

    if not u.is_active:
        code = f"{random.randint(0, 999999):06d}"
        u.verification_code = code
        db.commit()
        try:
            send_activation_code_email(to_email=u.email, code=code, ttl_seconds=600)
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Failed to send activation email: {e}")

        audit_event(
            "auth.activation_required",
            request,
            target_user_id=u.id,
            target_email=u.email,
            success=False,
            reason="inactive",
            extra={"ip": ip},
        )
        return {
            "email": u.email,
            "verification_required": True,
        }

    step_up = should_step_up(user_id=int(u.id), email=str(u.email), ip=ip)
    clear_login_failures(email=str(u.email), ip=ip)

    if _twofa_required(u) or step_up.required:
        try:
            challenge_id, code, ttl = create_challenge(user_id=int(u.id))
            send_2fa_code_email(to_email=u.email, code=code, ttl_seconds=int(ttl))
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Failed to start 2FA: {e}")

        audit_event(
            "auth.2fa_challenge_issued",
            request,
            target_user_id=u.id,
            target_email=u.email,
            success=True,
            reason="twofa_required" if _twofa_required(u) else "step_up",
            extra={"ip": ip, "step_up_reason": step_up.reason},
        )
        return {"requires_2fa": True, "challenge_id": challenge_id, "expires_in": int(ttl)}

    access, exp = create_access(u.id, u.role or "")
    refresh, _ = create_refresh(u.id)
    mark_known_ip(user_id=int(u.id), ip=ip)
    audit_event("auth.login_success", request, target_user_id=u.id, target_email=u.email, success=True, extra={"ip": ip})
    AUTH_LOGIN_SUCCESS_TOTAL.inc()
    log.info(
        "User login",
        extra={"event": "login_success", "user_id": int(u.id), "role": str(u.role or ""), "ip": ip},
    )
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=int(exp - __import__("time").time()),
    )


@router.post("/platonus", response_model=Union[PlatonusLoginResponse, TwoFAChallengeResponse, PlatonusEmailRequiredResponse])
def platonus_login(req: PlatonusLoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    enforce_rate_limit(
        action="platonus_login",
        scope="ip",
        ident=ip or "unknown",
        limit=int(settings.AUTH_RL_LOGIN_IP_LIMIT),
        window_seconds=int(settings.AUTH_RL_LOGIN_IP_WINDOW_SECONDS),
    )
    lock = check_lockout(email=None, ip=ip)
    if lock.locked:
        audit_event(
            "auth.platonus_blocked",
            request,
            success=False,
            reason="lockout",
            extra={"retry_after": lock.retry_after, "ip": ip},
        )
        raise HTTPException(status_code=429, detail="Too many attempts", headers={"Retry-After": str(lock.retry_after)})

    audit_event("auth.platonus_attempt", request, extra={"ip": ip, "login": req.login})
    try:
        session = platonus_rest.login(
            login=req.login,
            password=req.password,
            iin=getattr(req, "iin", None),
            ic_number=getattr(req, "icNumber", None),
            allow_deducted=bool(getattr(req, "authForDeductedStudentsAndGraduates", False)),
        )
        person_id = platonus_rest.get_person_id(session=session)
        roles = platonus_rest.get_roles(session=session)
    except PlatonusAuthError as e:
        register_login_failure(email=None, ip=ip)
        audit_event("auth.platonus_failed", request, success=False, reason="invalid", extra={"ip": ip, "error": str(e)})
        raise HTTPException(status_code=401, detail=str(e) or "Platonus login failed")
    except requests.RequestException as e:
        audit_event("auth.platonus_failed", request, success=False, reason="upstream_unavailable", extra={"ip": ip, "error": str(e)})
        raise HTTPException(502, "Platonus service unavailable")
    except Exception as e:
        audit_event("auth.platonus_failed", request, success=False, reason="upstream_error", extra={"ip": ip, "error": str(e)})
        raise HTTPException(502, "Platonus service error")

    role_names = [
        str(r.get("name") or "").strip().lower()
        for r in roles
        if isinstance(r, dict)
    ]

    def _has(substr: str) -> bool:
        s = substr.lower()
        return any(s in name for name in role_names if name)

    if _has("декан"):
        register_login_failure(email=None, ip=ip)
        raise HTTPException(status_code=403, detail="Доступ запрещен для роли 'деканат'")

    try:
        if _has("студент"):
            role = "student"
            info = platonus_rest.get_student_info(session=session, person_id=person_id, lang="ru")
        elif _has("библиотек"):
            role = "librarian"
            info = platonus_rest.get_employee_info(session=session, person_id=person_id, org_id=3, lang="ru", dn=1)
        elif _has("преподав"):
            role = "teacher"
            info = platonus_rest.get_employee_info(session=session, person_id=person_id, org_id=3, lang="ru", dn=1)
        else:
            role = None
            info = platonus_rest.get_student_info(session=session, person_id=person_id, lang="ru")
    except requests.RequestException as e:
        audit_event("auth.platonus_failed", request, success=False, reason="upstream_unavailable", extra={"ip": ip, "error": str(e)})
        raise HTTPException(502, "Platonus service unavailable")
    except Exception as e:
        audit_event("auth.platonus_failed", request, success=False, reason="upstream_error", extra={"ip": ip, "error": str(e)})
        raise HTTPException(502, "Platonus service error")

    if not info:
        raise HTTPException(502, "Invalid response from Platonus")

    desired_role = None
    if role in {"teacher", "librarian"}:
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
        desired_role = role
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

    u_by_iin = db.query(User).filter_by(iin=iin).first()
    existing_by_email = db.query(User).filter_by(email=corporate_email).first()
    if existing_by_email and (existing_by_email.iin or "") != (iin or ""):
        lang = get_lang(request)
        def _looks_like_email(value: str) -> bool:
            v = str(value or "").strip()
            if "@" not in v:
                return False
            local, domain = v.rsplit("@", 1)
            domain = domain.strip()
            return bool(local.strip()) and bool(domain) and "." in domain and not domain.startswith(".") and not domain.endswith(".")

        if (
            u_by_iin
            and u_by_iin.email
            and str(u_by_iin.email).strip().lower() != str(corporate_email).strip().lower()
            and _looks_like_email(str(u_by_iin.email))
        ):
            payload = {
                "iin": iin,
                "role": desired_role or "student",
                "first_name": first_name,
                "last_name": last_name,
                "orig_email": corporate_email,
            }
            bound_email = str(u_by_iin.email).strip().lower()
            challenge_id, ttl = create_email_change_challenge(payload=payload)
            try:
                code, code_ttl = request_email_change_code(challenge_id=challenge_id, email=bound_email)
                send_activation_code_email(to_email=bound_email, code=code, ttl_seconds=int(code_ttl))
            except PermissionError as e:
                try:
                    retry_after = int(str(e))
                except Exception:
                    retry_after = int(settings.TWOFA_RESEND_COOLDOWN_SECONDS)
                raise HTTPException(status_code=429, detail="Too many requests", headers={"Retry-After": str(retry_after)})
            except Exception as e:
                raise HTTPException(status_code=503, detail=f"Failed to send email: {e}")

            audit_event(
                "auth.platonus_email_code_sent",
                request,
                success=True,
                extra={"ip": ip, "challenge_id": challenge_id, "email": bound_email, "ttl": ttl},
            )
            msg_code_sent = {
                "en": "We sent a verification code to your linked email.",
                "ru": "Мы отправили код подтверждения на вашу привязанную почту.",
                "kk": "Байланыстырылған поштаңызға растау коды жіберілді.",
            }.get(lang, "We sent a verification code to your linked email.")
            return PlatonusEmailRequiredResponse(
                challenge_id=challenge_id,
                existing_email=corporate_email,
                bound_email=bound_email,
                code_sent=True,
                expires_in=int(code_ttl),
                message=msg_code_sent,
            )
        msg = {
            "en": "Email already registered. Please enter another email and verify it with a code.",
            "ru": "Эта почта уже зарегистрирована. Введите другую почту и подтвердите её кодом из письма.",
            "kk": "Бұл email бұрын тіркелген. Басқа email енгізіп, хаттағы кодпен растаңыз.",
        }.get(lang, "Email already registered. Please enter another email and verify it with a code.")
        challenge_id, ttl = create_email_change_challenge(
            payload={
                "iin": iin,
                "role": desired_role or "student",
                "first_name": first_name,
                "last_name": last_name,
                "orig_email": corporate_email,
            }
        )
        audit_event(
            "auth.platonus_email_conflict",
            request,
            success=False,
            reason="email_taken",
            extra={"ip": ip, "existing_email": corporate_email, "challenge_id": challenge_id, "ttl": ttl},
        )
        return PlatonusEmailRequiredResponse(
            challenge_id=challenge_id,
            existing_email=corporate_email,
            message=msg,
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

    step_up = should_step_up(user_id=int(u.id), email=str(u.email), ip=ip)
    clear_login_failures(email=str(u.email), ip=ip)

    if _twofa_required(u) or step_up.required:
        try:
            challenge_id, code, ttl = create_challenge(user_id=int(u.id))
            send_2fa_code_email(to_email=u.email, code=code, ttl_seconds=int(ttl))
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Failed to start 2FA: {e}")
        audit_event(
            "auth.2fa_challenge_issued",
            request,
            target_user_id=u.id,
            target_email=u.email,
            success=True,
            reason="twofa_required" if _twofa_required(u) else "step_up",
            extra={"ip": ip, "step_up_reason": step_up.reason},
        )
        return {"requires_2fa": True, "challenge_id": challenge_id, "expires_in": int(ttl)}

    access, exp = create_access(u.id, u.role or "")
    refresh, _ = create_refresh(u.id)
    mark_known_ip(user_id=int(u.id), ip=ip)
    audit_event("auth.platonus_success", request, target_user_id=u.id, target_email=u.email, success=True, extra={"ip": ip})
    return PlatonusLoginResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=int(exp - __import__("time").time()),
        role=role,
        info=info,
    )


@router.post("/platonus/email/request")
def platonus_email_request(body: PlatonusEmailRequest, request: Request):
    ip = get_client_ip(request)
    enforce_rate_limit(action="platonus_email_request", scope="ip", ident=ip or "unknown", limit=10, window_seconds=300)
    lang = get_lang(request)

    email = str(body.email).strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    payload_iin = ""
    try:
        payload = peek_email_change_payload(challenge_id=body.challenge_id)
        payload_iin = str(payload.get("iin") or "").strip()
    except Exception:
        payload_iin = ""

    # Ensure email is not already used
    db = SessionLocal()
    try:
        owner = db.query(User).filter_by(email=email).first()
        if owner and (not payload_iin or (owner.iin or "") != payload_iin):
            detail = {
                "en": "Email already exists",
                "ru": "Email уже используется",
                "kk": "Email бұрыннан бар",
            }.get(lang, "Email already exists")
            raise HTTPException(status_code=409, detail=detail)
    finally:
        db.close()

    try:
        code, ttl = request_email_change_code(challenge_id=body.challenge_id, email=email)
    except PermissionError as e:
        try:
            retry_after = int(str(e))
        except Exception:
            retry_after = int(settings.TWOFA_RESEND_COOLDOWN_SECONDS)
        raise HTTPException(status_code=429, detail="Too many requests", headers={"Retry-After": str(retry_after)})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e) or "Invalid challenge")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Unavailable: {e}")

    try:
        send_activation_code_email(to_email=email, code=code, ttl_seconds=int(ttl))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to send email: {e}")

    audit_event(
        "auth.platonus_email_code_sent",
        request,
        success=True,
        extra={"ip": ip, "challenge_id": body.challenge_id, "email": email},
    )
    return {"ok": True, "expires_in": int(ttl)}


@router.post("/platonus/email/verify", response_model=TokenPair)
def platonus_email_verify(body: PlatonusEmailVerifyRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    enforce_rate_limit(action="platonus_email_verify", scope="ip", ident=ip or "unknown", limit=20, window_seconds=300)
    lang = get_lang(request)

    email = str(body.email).strip().lower()
    try:
        payload = verify_email_change_code(challenge_id=body.challenge_id, email=email, code=body.code)
    except ValueError as e:
        msg = str(e) or "Invalid code"
        if msg in {"Too many attempts"}:
            raise HTTPException(status_code=429, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Unavailable: {e}")

    iin = str(payload.get("iin") or "").strip()
    new_role = str(payload.get("role") or "student").strip().lower()
    first_name = payload.get("first_name")
    last_name = payload.get("last_name")
    if not iin:
        raise HTTPException(status_code=400, detail="Invalid challenge payload")

    email_owner = db.query(User).filter_by(email=email).first()
    if email_owner and (email_owner.iin or "") != iin:
        detail = {
            "en": "Email already exists",
            "ru": "Email уже используется",
            "kk": "Email бұрыннан бар",
        }.get(lang, "Email already exists")
        raise HTTPException(status_code=409, detail=detail)

    u = db.query(User).filter_by(iin=iin).first()
    if not u:
        u = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(24)),
            iin=iin,
            is_active=True,
            role=new_role or "student",
        )
        if first_name:
            u.first_name = first_name
        if last_name:
            u.last_name = last_name
        db.add(u)
        db.commit()
        db.refresh(u)
    else:
        u.email = email
        if new_role and (not u.role or (u.role or "").strip().lower() == "student"):
            u.role = new_role
        if first_name and not u.first_name:
            u.first_name = first_name
        if last_name and not u.last_name:
            u.last_name = last_name
        u.is_active = True
        db.commit()
        db.refresh(u)

    access, exp = create_access(u.id, u.role or "")
    refresh, _ = create_refresh(u.id)
    mark_known_ip(user_id=int(u.id), ip=ip)
    audit_event("auth.platonus_email_verified", request, target_user_id=u.id, target_email=u.email, success=True, extra={"ip": ip})
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=int(exp - __import__("time").time()),
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


@router.post("/introspect_any", response_model=IntrospectAnyResponse)
def introspect_any(body: IntrospectRequest):
    # Signature check but ignore expiration; supports both access/refresh tokens.
    try:
        from jose import jwt

        payload = jwt.decode(
            body.token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALG],
            options={"verify_exp": False},
        )
    except Exception:
        return IntrospectAnyResponse(active=False)

    sub = payload.get("sub")
    try:
        user_id = int(sub) if sub is not None else None
    except Exception:
        user_id = None

    roles = payload.get("roles") or []
    if isinstance(roles, str):
        roles = [roles]
    if not isinstance(roles, list):
        roles = []

    typ = payload.get("typ")
    if typ != "access":
        roles = []

    return IntrospectAnyResponse(
        active=bool(user_id),
        user_id=user_id,
        roles=[str(r) for r in roles if r is not None],
        exp=payload.get("exp"),
        typ=str(typ) if typ is not None else None,
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
def twofa_verify(body: TwoFAVerifyRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    enforce_rate_limit(
        action="2fa_verify",
        scope="ip",
        ident=ip or "unknown",
        limit=int(settings.AUTH_RL_2FA_VERIFY_IP_LIMIT),
        window_seconds=int(settings.AUTH_RL_2FA_VERIFY_IP_WINDOW_SECONDS),
    )
    audit_event("auth.2fa_verify_attempt", request, extra={"ip": ip, "challenge_id": body.challenge_id})
    try:
        user_id = verify_code(challenge_id=body.challenge_id, code=body.code)
    except ValueError as e:
        msg = str(e) or "Invalid code"
        if msg in {"Too many attempts"}:
            audit_event("auth.2fa_verify_failed", request, success=False, reason=msg, extra={"ip": ip, "challenge_id": body.challenge_id})
            raise HTTPException(status_code=429, detail=msg)
        audit_event("auth.2fa_verify_failed", request, success=False, reason=msg, extra={"ip": ip, "challenge_id": body.challenge_id})
        raise HTTPException(status_code=400, detail=msg)
    except Exception as e:
        audit_event("auth.2fa_verify_failed", request, success=False, reason="unavailable", extra={"ip": ip, "error": str(e)})
        raise HTTPException(status_code=503, detail=f"2FA unavailable: {e}")

    u = db.get(User, int(user_id))
    if not u or not u.is_active:
        audit_event("auth.2fa_verify_failed", request, success=False, reason="invalid_user", extra={"ip": ip, "user_id": int(user_id or 0)})
        raise HTTPException(401, "Invalid credentials")

    access, exp = create_access(u.id, u.role or "")
    refresh, _ = create_refresh(u.id)
    mark_known_ip(user_id=int(u.id), ip=ip)
    audit_event("auth.2fa_verify_success", request, target_user_id=u.id, target_email=u.email, success=True, extra={"ip": ip})
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=int(exp - __import__("time").time()),
    )


@router.post("/2fa/resend")
def twofa_resend(body: TwoFAResendRequest, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    enforce_rate_limit(
        action="2fa_resend",
        scope="ip",
        ident=ip or "unknown",
        limit=int(settings.AUTH_RL_2FA_RESEND_IP_LIMIT),
        window_seconds=int(settings.AUTH_RL_2FA_RESEND_IP_WINDOW_SECONDS),
    )
    audit_event("auth.2fa_resend_attempt", request, extra={"ip": ip, "challenge_id": body.challenge_id})
    try:
        user_id, code, ttl = resend_code(challenge_id=body.challenge_id)
    except PermissionError as e:
        try:
            retry_after = int(str(e))
        except Exception:
            retry_after = int(settings.TWOFA_RESEND_COOLDOWN_SECONDS)
        audit_event("auth.2fa_resend_failed", request, success=False, reason="cooldown", extra={"ip": ip, "challenge_id": body.challenge_id, "retry_after": retry_after})
        raise HTTPException(status_code=429, detail="Too many requests", headers={"Retry-After": str(retry_after)})
    except ValueError as e:
        audit_event("auth.2fa_resend_failed", request, success=False, reason=str(e) or "invalid", extra={"ip": ip, "challenge_id": body.challenge_id})
        raise HTTPException(status_code=400, detail=str(e) or "Invalid challenge")
    except Exception as e:
        audit_event("auth.2fa_resend_failed", request, success=False, reason="unavailable", extra={"ip": ip, "error": str(e)})
        raise HTTPException(status_code=503, detail=f"2FA unavailable: {e}")

    u = db.get(User, int(user_id))
    if not u:
        audit_event("auth.2fa_resend_failed", request, success=False, reason="user_not_found", extra={"ip": ip, "user_id": int(user_id or 0)})
        raise HTTPException(404, "User not found")

    try:
        send_2fa_code_email(to_email=u.email, code=code, ttl_seconds=int(ttl))
    except Exception as e:
        audit_event("auth.2fa_resend_failed", request, success=False, reason="email_send_failed", extra={"ip": ip, "error": str(e)})
        raise HTTPException(status_code=503, detail=f"Failed to send 2FA email: {e}")

    audit_event("auth.2fa_resend_success", request, target_user_id=u.id, target_email=u.email, success=True, extra={"ip": ip, "expires_in": int(ttl)})
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
