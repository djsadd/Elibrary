from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_email(*, to_email: str, subject: str, text_body: str) -> None:
    host = (settings.SMTP_HOST or "").strip()
    if not host:
        raise RuntimeError("SMTP_HOST is not configured")

    from_email = (settings.SMTP_FROM or settings.SMTP_USER or "").strip()
    if not from_email:
        raise RuntimeError("SMTP_FROM/SMTP_USER is not configured")

    msg = EmailMessage()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text_body)

    if settings.SMTP_USE_SSL:
        with smtplib.SMTP_SSL(host=host, port=int(settings.SMTP_PORT), timeout=15) as smtp:
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        return

    with smtplib.SMTP(host=host, port=int(settings.SMTP_PORT), timeout=15) as smtp:
        smtp.ehlo()
        if settings.SMTP_USE_TLS:
            smtp.starttls()
            smtp.ehlo()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)


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

