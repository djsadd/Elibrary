from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import requests

from app.core.config import settings


_DEFAULT_BASE = "https://platonus.tau-edu.kz"


def _base() -> str:
    raw = str(getattr(settings, "PLATONUS_AUTH_URL", "") or "").strip()
    try:
        u = urlparse(raw)
        if u.scheme and u.netloc:
            return f"{u.scheme}://{u.netloc}"
    except Exception:
        pass
    return _DEFAULT_BASE


@dataclass(frozen=True)
class PlatonusSession:
    auth_token: str
    sid: str


class PlatonusAuthError(RuntimeError):
    pass


def _headers(session: PlatonusSession) -> dict[str, str]:
    # Based on observed Platonus REST usage:
    # - token and sid are expected as headers
    # - X-Requested-With helps bypass some checks
    # - cookie with plt_sid/sid improves compatibility
    cookie_bits = []
    if session.sid:
        cookie_bits.append(f"plt_sid={session.sid}")
        cookie_bits.append(f"sid={session.sid}")
    cookie = "; ".join(cookie_bits)
    h = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
    }
    if session.auth_token:
        h["token"] = session.auth_token
    if session.sid:
        h["sid"] = session.sid
    if cookie:
        h["Cookie"] = cookie
    return h


def login(
    *,
    login: str,
    password: str,
    iin: str | None = None,
    ic_number: str | None = None,
    allow_deducted: bool = False,
    timeout_s: int = 20,
) -> PlatonusSession:
    url = f"{_base()}/rest/api/login"
    payload = {
        "login": login,
        "password": password,
        "iin": iin,
        "icNumber": ic_number,
        "authForDeductedStudentsAndGraduates": "true" if allow_deducted else "false",
    }
    r = requests.post(url, json=payload, headers={"X-Requested-With": "XMLHttpRequest", "Accept": "application/json"}, timeout=timeout_s)
    try:
        data = r.json()
    except Exception:
        raise PlatonusAuthError(f"Platonus login non-JSON response (HTTP {r.status_code})")

    if str(data.get("login_status", "")).lower() != "success":
        msg = data.get("message") or "Platonus login failed"
        raise PlatonusAuthError(str(msg))

    auth_token = str(data.get("auth_token") or "").strip()
    sid = str(data.get("sid") or "").strip()
    if not auth_token or not sid:
        raise PlatonusAuthError("Platonus login missing auth_token/sid")
    return PlatonusSession(auth_token=auth_token, sid=sid)


def get_person_id(*, session: PlatonusSession, timeout_s: int = 20) -> str:
    url = f"{_base()}/rest/api/person/personID"
    r = requests.get(url, headers=_headers(session), timeout=timeout_s)
    r.raise_for_status()
    data = r.json()
    pid = data.get("personID")
    if not pid:
        raise PlatonusAuthError("Platonus personID missing")
    return str(pid)


def get_roles(*, session: PlatonusSession, timeout_s: int = 20) -> list[dict[str, Any]]:
    url = f"{_base()}/rest/api/person/roles"
    r = requests.get(url, headers=_headers(session), timeout=timeout_s)
    r.raise_for_status()
    data = r.json()
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    return []


def get_student_info(*, session: PlatonusSession, person_id: str, lang: str = "ru", timeout_s: int = 20) -> dict[str, Any]:
    url = f"{_base()}/rest/student/studentInfo/{person_id}/{lang}"
    r = requests.get(url, headers=_headers(session), timeout=timeout_s)
    r.raise_for_status()
    data = r.json()
    if isinstance(data, dict):
        return data
    return {"data": data}


def get_employee_info(
    *,
    session: PlatonusSession,
    person_id: str,
    org_id: int = 3,
    lang: str = "ru",
    dn: int = 1,
    timeout_s: int = 20,
) -> dict[str, Any]:
    url = f"{_base()}/rest/employee/employeeInfo/{person_id}/{org_id}/{lang}?dn={dn}"
    r = requests.get(url, headers=_headers(session), timeout=timeout_s)
    r.raise_for_status()
    data = r.json()
    if isinstance(data, dict):
        return data
    return {"data": data}
