from __future__ import annotations

import json
import time
from dataclasses import dataclass

from fastapi import HTTPException, Request

from app.core.config import settings
from app.core.redis import r


def _normalize_email(email: str | None) -> str:
    return (email or "").strip().lower()


def get_client_ip(request: Request) -> str:
    if bool(settings.AUTH_TRUST_PROXY_HEADERS):
        xff = request.headers.get("X-Forwarded-For")
        if xff:
            # "client, proxy1, proxy2"
            ip = xff.split(",")[0].strip()
            if ip:
                return ip
        xri = request.headers.get("X-Real-IP")
        if xri:
            ip = xri.strip()
            if ip:
                return ip
    return getattr(getattr(request, "client", None), "host", "") or ""


def _redis_guard(exc: Exception) -> None:
    if bool(settings.AUTH_FAIL_CLOSED_ON_REDIS):
        raise HTTPException(status_code=503, detail="Security controls unavailable")


def _rate_key(action: str, scope: str, ident: str) -> str:
    return f"rl:{action}:{scope}:{ident}"


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    current: int
    retry_after: int


def check_rate_limit(*, key: str, limit: int, window_seconds: int) -> RateLimitResult:
    try:
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.ttl(key)
        current, ttl = pipe.execute()
        current = int(current or 0)
        ttl = int(ttl or -1)
        if current == 1 or ttl < 0:
            r.expire(key, int(window_seconds))
            ttl = int(window_seconds)
        allowed = current <= int(limit)
        retry_after = max(ttl, 0) if not allowed else 0
        return RateLimitResult(allowed=allowed, current=current, retry_after=retry_after)
    except Exception as e:
        _redis_guard(e)
        return RateLimitResult(allowed=True, current=0, retry_after=0)


def enforce_rate_limit(
    *,
    action: str,
    scope: str,
    ident: str,
    limit: int,
    window_seconds: int,
) -> None:
    key = _rate_key(action, scope, ident)
    res = check_rate_limit(key=key, limit=limit, window_seconds=window_seconds)
    if not res.allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many requests",
            headers={"Retry-After": str(int(res.retry_after or window_seconds))},
        )


def _fail_key_email(email: str) -> str:
    return f"auth:login:fail:email:{_normalize_email(email)}"


def _fail_key_ip(ip: str) -> str:
    return f"auth:login:fail:ip:{ip}"


def _lock_key_email(email: str) -> str:
    return f"auth:login:lock:email:{_normalize_email(email)}"


def _lock_key_ip(ip: str) -> str:
    return f"auth:login:lock:ip:{ip}"


def _known_ips_key(user_id: int) -> str:
    return f"auth:user:{int(user_id)}:known_ips"


@dataclass(frozen=True)
class LockoutStatus:
    locked: bool
    retry_after: int


def check_lockout(*, email: str | None, ip: str | None) -> LockoutStatus:
    try:
        retry_after = 0
        locked = False
        if email:
            ttl = int(r.ttl(_lock_key_email(email)) or -1)
            if ttl > 0:
                locked = True
                retry_after = max(retry_after, ttl)
        if ip:
            ttl = int(r.ttl(_lock_key_ip(ip)) or -1)
            if ttl > 0:
                locked = True
                retry_after = max(retry_after, ttl)
        return LockoutStatus(locked=locked, retry_after=max(retry_after, 0))
    except Exception as e:
        _redis_guard(e)
        return LockoutStatus(locked=False, retry_after=0)


@dataclass(frozen=True)
class FailureUpdate:
    email_failures: int
    ip_failures: int
    locked: bool
    retry_after: int


def register_login_failure(*, email: str | None, ip: str | None) -> FailureUpdate:
    window = int(settings.AUTH_LOCKOUT_WINDOW_SECONDS)
    lock_duration = int(settings.AUTH_LOCKOUT_DURATION_SECONDS)
    email_failures = 0
    ip_failures = 0
    try:
        pipe = r.pipeline()
        if email:
            pipe.incr(_fail_key_email(email))
            pipe.ttl(_fail_key_email(email))
        if ip:
            pipe.incr(_fail_key_ip(ip))
            pipe.ttl(_fail_key_ip(ip))
        results = pipe.execute()

        idx = 0
        if email:
            email_failures = int(results[idx] or 0)
            email_ttl = int(results[idx + 1] or -1)
            if email_failures == 1 or email_ttl < 0:
                r.expire(_fail_key_email(email), window)
            idx += 2
        if ip:
            ip_failures = int(results[idx] or 0)
            ip_ttl = int(results[idx + 1] or -1)
            if ip_failures == 1 or ip_ttl < 0:
                r.expire(_fail_key_ip(ip), window)

        locked = False
        retry_after = 0
        if email and email_failures >= int(settings.AUTH_LOCKOUT_THRESHOLD_EMAIL):
            r.setex(
                _lock_key_email(email),
                lock_duration,
                json.dumps(
                    {
                        "reason": "threshold_email",
                        "locked_at": int(time.time()),
                        "email_failures": int(email_failures),
                        "ip_failures": int(ip_failures),
                    },
                    separators=(",", ":"),
                ),
            )
            locked = True
            retry_after = max(retry_after, lock_duration)
        if ip and ip_failures >= int(settings.AUTH_LOCKOUT_THRESHOLD_IP):
            r.setex(
                _lock_key_ip(ip),
                lock_duration,
                json.dumps(
                    {
                        "reason": "threshold_ip",
                        "locked_at": int(time.time()),
                        "email_failures": int(email_failures),
                        "ip_failures": int(ip_failures),
                    },
                    separators=(",", ":"),
                ),
            )
            locked = True
            retry_after = max(retry_after, lock_duration)

        return FailureUpdate(
            email_failures=email_failures,
            ip_failures=ip_failures,
            locked=locked,
            retry_after=retry_after,
        )
    except Exception as e:
        _redis_guard(e)
        return FailureUpdate(email_failures=0, ip_failures=0, locked=False, retry_after=0)


def clear_login_failures(*, email: str | None, ip: str | None) -> None:
    try:
        keys: list[str] = []
        if email:
            keys.append(_fail_key_email(email))
        if ip:
            keys.append(_fail_key_ip(ip))
        if keys:
            r.delete(*keys)
    except Exception as e:
        _redis_guard(e)
        return


@dataclass(frozen=True)
class StepUpDecision:
    required: bool
    reason: str | None


def should_step_up(*, user_id: int, email: str | None, ip: str | None) -> StepUpDecision:
    try:
        email = _normalize_email(email)
        if email:
            failures = int(r.get(_fail_key_email(email)) or 0)
            if failures >= int(settings.AUTH_STEPUP_THRESHOLD_EMAIL):
                return StepUpDecision(required=True, reason="recent_failures_email")
        if ip:
            failures = int(r.get(_fail_key_ip(ip)) or 0)
            if failures >= int(settings.AUTH_STEPUP_THRESHOLD_IP):
                return StepUpDecision(required=True, reason="recent_failures_ip")

        if bool(settings.AUTH_STEPUP_ON_NEW_IP) and ip:
            k = _known_ips_key(int(user_id))
            if r.exists(k) == 1 and r.sismember(k, ip) == 0:
                return StepUpDecision(required=True, reason="new_ip")

        return StepUpDecision(required=False, reason=None)
    except Exception as e:
        _redis_guard(e)
        return StepUpDecision(required=False, reason=None)


def mark_known_ip(*, user_id: int, ip: str | None) -> None:
    if not ip:
        return
    try:
        k = _known_ips_key(int(user_id))
        r.sadd(k, ip)
        r.expire(k, int(settings.AUTH_KNOWN_IP_TTL_SECONDS))
    except Exception as e:
        _redis_guard(e)
        return


def now_ts() -> int:
    return int(time.time())
