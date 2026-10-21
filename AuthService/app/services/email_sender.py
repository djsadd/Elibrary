from __future__ import annotations

import smtplib
import ssl
from contextlib import contextmanager
from email.message import EmailMessage

from app.core.config import settings


@contextmanager
def _smtp_connection():
    host = (settings.SMTP_HOST or "").strip()
    if not host:
        raise RuntimeError("SMTP_HOST is not configured")

    from_email = (settings.SMTP_FROM or settings.SMTP_USER or "").strip()
    if not from_email:
        raise RuntimeError("SMTP_FROM/SMTP_USER is not configured")

    if bool(settings.SMTP_USER) != bool(settings.SMTP_PASSWORD):
        raise RuntimeError("SMTP credentials are incomplete")
    connection = smtplib.SMTP_SSL if settings.SMTP_USE_SSL else smtplib.SMTP
    options = {"context": ssl.create_default_context()} if settings.SMTP_USE_SSL else {}
    with connection(host=host, port=int(settings.SMTP_PORT), timeout=15, **options) as smtp:
        smtp.ehlo()
        if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        yield smtp, from_email


def ensure_email_delivery_available() -> None:
    """Probe transport/configuration identically for known and unknown addresses."""
    with _smtp_connection() as (smtp, _):
        status, _ = smtp.noop()
        if status != 250:
            raise RuntimeError("SMTP transport unavailable")


def send_email(*, to_email: str, subject: str, text_body: str) -> None:
    with _smtp_connection() as (smtp, from_email):
        msg = EmailMessage()
        msg["From"] = from_email
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(text_body)
        if smtp.send_message(msg):
            raise RuntimeError("SMTP recipient rejected")


def send_password_reset_code_email(*, to_email: str, code: str, ttl_seconds: int) -> None:
    minutes = max(1, int(round(ttl_seconds / 60)))
    send_email(
        to_email=to_email,
        subject="Reset your TAU Library password",
        text_body=(
            f"Your password reset code:\n\n{code}\n\n"
            f"It expires in {minutes} minute(s) and can be used once. "
            "If you did not request a password reset, ignore this email. "
            "Your password has not changed.\n\n"
            "This code changes only your library email password, not your Platonus password."
        ),
    )


def send_2fa_code_email(*, to_email: str, code: str, ttl_seconds: int) -> None:
    minutes = max(1, int(round(ttl_seconds / 60)))
    subject = "Your TAU Library verification code"
    body = (
        "Your login verification code:\n\n"
        f"{code}\n\n"
        f"It expires in ~{minutes} minute(s). If you didn't request this code, you can ignore this email."
    )
    send_email(to_email=to_email, subject=subject, text_body=body)


def send_activation_code_email(*, to_email: str, code: str, ttl_seconds: int = 600) -> None:
    minutes = max(1, int(round(ttl_seconds / 60)))
    subject = "Activate your TAU Library account"
    body = (
        "Your activation code:\n\n"
        f"{code}\n\n"
        f"It expires in ~{minutes} minute(s)."
    )
    send_email(to_email=to_email, subject=subject, text_body=body)

