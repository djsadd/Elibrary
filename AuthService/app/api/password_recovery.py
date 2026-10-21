from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from redis.exceptions import RedisError
from sqlalchemy import func, or_, update
from sqlalchemy.orm import Session

from app.api.routes import get_db
from app.models.user import User
from app.schemas.auth import PasswordResetConfirmRequest, PasswordResetRequest
from app.services import email_sender, password_reset
from app.services.audit import audit_event
from app.services.security_controls import get_client_ip
from app.utils.security import hash_password
from app.utils.tokens import invalidate_user_sessions

router = APIRouter(prefix="/auth/password-reset", tags=["password recovery"])


@router.post("/request", status_code=202)
def request_password_reset(body: PasswordResetRequest, request: Request, response: Response,
                           background: BackgroundTasks, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    email = str(body.email).strip().lower()
    password_reset.enforce_limits(action="request", email=email, ip=get_client_ip(request))
    # The same configuration and SMTP connectivity check runs for every address.
    # A missing SMTP server must never become a pretend successful delivery.
    try:
        email_sender.ensure_email_delivery_available()
    except Exception as exc:
        raise HTTPException(503, "Password recovery email service unavailable",
                            headers={"Cache-Control": "no-store"}) from exc
    user = db.query(User).filter(func.lower(User.email) == email).first()
    try:
        nonce, code, ttl = password_reset.create_challenge(email=email, user=user)
    except RedisError as exc:
        raise HTTPException(503, "Password recovery temporarily unavailable") from exc
    if password_reset.eligible(user):
        background.add_task(password_reset.deliver_code, email=user.email, nonce=nonce, code=code, ttl=ttl)
    audit_event("auth.password_reset_requested", request, extra={"identity": password_reset.email_identity(email)})
    return {"message": "If this address belongs to an eligible account, you will receive a password reset code.",
            "expires_in": ttl}


@router.post("/confirm")
def confirm_password_reset(body: PasswordResetConfirmRequest, request: Request, response: Response,
                           db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    email = str(body.email).strip().lower()
    password_reset.enforce_limits(action="confirm", email=email, ip=get_client_ip(request))
    try:
        state = password_reset.consume_challenge(email=email, code=body.code)
    except ValueError as exc:
        raise HTTPException(400, "Invalid or expired code") from exc
    except RedisError as exc:
        raise HTTPException(503, "Password recovery temporarily unavailable") from exc
    user = db.get(User, int(state["uid"]))
    if not password_reset.password_is_current(user, state) or user.email.lower() != email:
        raise HTTPException(400, "Invalid or expired code")
    old_hash = user.hashed_password
    # Argon2id handles the complete password, including Unicode and >72 bytes.
    # A conditional UPDATE prevents a concurrent password change from being lost.
    new_hash = hash_password(body.new_password)
    result = db.execute(update(User).where(User.id == user.id, User.hashed_password == old_hash,
                                         func.lower(User.email) == email,
                                         User.is_active.is_(True), User.email_verified.is_(True),
                                         or_(User.iin.is_(None), User.iin == ""),
                                         or_(User.google_id.is_(None), User.google_id == ""),
                                         or_(User.github_id.is_(None), User.github_id == ""))
                        .values(hashed_password=new_hash), execution_options={"synchronize_session": False})
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(400, "Invalid or expired code")
    try:
        # Fail before committing the new password if sessions cannot be revoked.
        invalidate_user_sessions(user.id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    audit_event("auth.password_reset_completed", request, target_user_id=user.id, success=True)
    return {"message": "Password updated. Sign in with your new password."}
