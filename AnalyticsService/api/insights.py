"""Aggregated insights over gateway traffic: admin dashboard + personal activity."""

import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from core.db import SessionLocal
from utils.authz import AuthUser, get_current_user, require_roles
from utils.time import get_tz, range_for_dates

# Mounted inside api.routes.router, which already carries the "/analytics" prefix.
router = APIRouter(tags=["analytics-insights"])

BASE_FILTER = "event_type = 'api_request' AND (path IS NULL OR path <> '/metrics')"
VISITOR_KEY = "COALESCE(user_id::text, NULLIF(anon_id, ''), NULLIF(ip_hash, ''))"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------------------------------- #
# User-agent parsing (tiny, dependency-free)
# --------------------------------------------------------------------------- #

_BOT_RE = re.compile(r"bot|crawl|spider|slurp|curl|wget|python|httpx|okhttp|postman|insomnia|go-http", re.I)


def parse_user_agent(ua: str | None) -> dict[str, str]:
    ua = ua or ""
    if not ua:
        return {"device": "unknown", "browser": "Other", "os": "Other"}
    if _BOT_RE.search(ua):
        device = "bot"
    elif re.search(r"iPad|Tablet|Nexus (7|9|10)|SM-T", ua):
        device = "tablet"
    elif re.search(r"Mobi|iPhone|Android.+Mobile|Windows Phone", ua):
        device = "mobile"
    elif "Android" in ua:
        device = "tablet"
    else:
        device = "desktop"

    if re.search(r"Edg/|EdgA/|EdgiOS/", ua):
        browser = "Edge"
    elif re.search(r"OPR/|Opera", ua):
        browser = "Opera"
    elif "YaBrowser" in ua:
        browser = "Yandex"
    elif "SamsungBrowser" in ua:
        browser = "Samsung"
    elif re.search(r"Firefox/|FxiOS/", ua):
        browser = "Firefox"
    elif re.search(r"Chrome/|CriOS/", ua):
        browser = "Chrome"
    elif "Safari/" in ua:
        browser = "Safari"
    else:
        browser = "Other"

    if "Windows" in ua:
        os_name = "Windows"
    elif re.search(r"iPhone|iPad|iPod", ua):
        os_name = "iOS"
    elif "Android" in ua:
        os_name = "Android"
    elif "Mac OS X" in ua or "Macintosh" in ua:
        os_name = "macOS"
    elif "CrOS" in ua:
        os_name = "ChromeOS"
    elif "Linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Other"
    return {"device": device, "browser": browser, "os": os_name}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _rows(db: Session, sql: str, **params: Any):
    return db.execute(text(sql), params).mappings().all()


def _one(db: Session, sql: str, **params: Any):
    return db.execute(text(sql), params).mappings().first() or {}


def _summary(db: Session, start: datetime, end: datetime, user_id: int | None = None) -> dict[str, int]:
    extra = " AND user_id = :uid" if user_id is not None else ""
    r = _one(
        db,
        f"""
        SELECT count(*) AS events,
               count(DISTINCT user_id) AS users,
               count(DISTINCT CASE WHEN user_id IS NULL THEN COALESCE(NULLIF(anon_id, ''), NULLIF(ip_hash, '')) END) AS guests,
               count(DISTINCT session_id) AS sessions,
               count(*) FILTER (WHERE status_code >= 500) AS errors_5xx,
               count(*) FILTER (WHERE status_code >= 400 AND status_code < 500) AS errors_4xx
        FROM events
        WHERE {BASE_FILTER} AND event_time >= :s AND event_time < :e{extra}
        """,
        s=start,
        e=end,
        uid=user_id,
    )
    return {k: int(r.get(k) or 0) for k in ("events", "users", "guests", "sessions", "errors_5xx", "errors_4xx")}


def _ua_breakdown(db: Session, start: datetime, end: datetime) -> dict[str, list[dict]]:
    rows = _rows(
        db,
        f"""
        SELECT user_agent, count(DISTINCT {VISITOR_KEY}) AS visitors
        FROM events
        WHERE {BASE_FILTER} AND event_time >= :s AND event_time < :e
        GROUP BY user_agent
        ORDER BY visitors DESC
        LIMIT 2000
        """,
        s=start,
        e=end,
    )
    buckets: dict[str, dict[str, int]] = {"device": defaultdict(int), "browser": defaultdict(int), "os": defaultdict(int)}
    for r in rows:
        parsed = parse_user_agent(r["user_agent"])
        for dim in buckets:
            buckets[dim][parsed[dim]] += int(r["visitors"] or 0)
    return {
        dim: [{"key": k, "count": v} for k, v in sorted(vals.items(), key=lambda kv: kv[1], reverse=True)]
        for dim, vals in buckets.items()
    }


def _referrer_pages(db: Session, start: datetime, end: datetime) -> list[dict]:
    """The SPA calls the API from its pages, so the Referer path tells which screens people use."""
    rows = _rows(
        db,
        f"""
        SELECT referrer, count(DISTINCT session_id) AS sessions, count(DISTINCT {VISITOR_KEY}) AS visitors
        FROM events
        WHERE {BASE_FILTER} AND event_time >= :s AND event_time < :e AND referrer IS NOT NULL AND referrer <> ''
        GROUP BY referrer
        ORDER BY sessions DESC
        LIMIT 3000
        """,
        s=start,
        e=end,
    )
    pages: dict[str, dict[str, int]] = defaultdict(lambda: {"sessions": 0, "visitors": 0})
    for r in rows:
        try:
            path = urlparse(r["referrer"]).path or "/"
        except Exception:
            continue
        # collapse numeric ids: /catalog/123 -> /catalog/:id
        path = re.sub(r"/\d+(?=/|$)", "/:id", path.rstrip("/") or "/")
        pages[path]["sessions"] += int(r["sessions"] or 0)
        pages[path]["visitors"] += int(r["visitors"] or 0)
    ranked = sorted(pages.items(), key=lambda kv: kv[1]["sessions"], reverse=True)[:12]
    return [{"path": p, **v} for p, v in ranked]


# --------------------------------------------------------------------------- #
# Admin insights
# --------------------------------------------------------------------------- #


@router.get("/stats/insights", dependencies=[Depends(require_roles("admin", "librarian"))])
def admin_insights(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    start, end = range_for_dates(from_date, to_date)
    span = end - start
    prev_start, prev_end = start - span, start
    tz = settings.TIMEZONE
    p = {"s": start, "e": end, "tz": tz}

    current = _summary(db, start, end)
    previous = _summary(db, prev_start, prev_end)

    daily = _rows(
        db,
        f"""
        SELECT date(timezone(:tz, event_time)) AS day,
               count(*) AS events,
               count(DISTINCT user_id) AS users,
               count(DISTINCT CASE WHEN user_id IS NULL THEN COALESCE(NULLIF(anon_id, ''), NULLIF(ip_hash, '')) END) AS guests,
               count(DISTINCT session_id) AS sessions,
               count(*) FILTER (WHERE status_code >= 500) AS errors
        FROM events
        WHERE {BASE_FILTER} AND event_time >= :s AND event_time < :e
        GROUP BY 1 ORDER BY 1
        """,
        **p,
    )
    daily_map = {r["day"]: r for r in daily}
    local_start = start.astimezone(get_tz()).date()
    local_end = (end - timedelta(seconds=1)).astimezone(get_tz()).date()
    daily_out = []
    d = local_start
    while d <= local_end:
        r = daily_map.get(d, {})
        daily_out.append(
            {
                "day": d.isoformat(),
                "events": int(r.get("events") or 0),
                "users": int(r.get("users") or 0),
                "guests": int(r.get("guests") or 0),
                "sessions": int(r.get("sessions") or 0),
                "errors": int(r.get("errors") or 0),
            }
        )
        d += timedelta(days=1)

    # DAU / WAU / MAU as of the end of the range
    stick = _one(
        db,
        f"""
        SELECT count(DISTINCT user_id) FILTER (WHERE event_time >= :e - interval '1 day')  AS dau,
               count(DISTINCT user_id) FILTER (WHERE event_time >= :e - interval '7 days') AS wau,
               count(DISTINCT user_id)                                                     AS mau
        FROM events
        WHERE {BASE_FILTER} AND user_id IS NOT NULL AND event_time >= :e - interval '30 days' AND event_time < :e
        """,
        e=end,
    )
    avg_dau = round(sum(r["users"] for r in daily_out) / len(daily_out), 1) if daily_out else 0.0

    heat_rows = _rows(
        db,
        f"""
        SELECT extract(isodow FROM timezone(:tz, event_time))::int AS dow,
               extract(hour FROM timezone(:tz, event_time))::int AS hour,
               count(DISTINCT session_id) AS sessions
        FROM events
        WHERE {BASE_FILTER} AND event_time >= :s AND event_time < :e
        GROUP BY 1, 2
        """,
        **p,
    )
    heatmap = [[0] * 24 for _ in range(7)]
    for r in heat_rows:
        heatmap[int(r["dow"]) - 1][int(r["hour"])] = int(r["sessions"] or 0)

    status_rows = _rows(
        db,
        f"""
        SELECT (status_code / 100) AS cls, count(*) AS n
        FROM events
        WHERE {BASE_FILTER} AND event_time >= :s AND event_time < :e AND status_code IS NOT NULL
        GROUP BY 1
        """,
        **p,
    )
    status = {f"{int(r['cls'])}xx": int(r["n"]) for r in status_rows if r["cls"]}

    error_paths = _rows(
        db,
        f"""
        SELECT regexp_replace(path, '/[0-9]+(/|$)', '/\\:id\\1', 'g') AS path, count(*) AS n, max(status_code) AS status
        FROM events
        WHERE {BASE_FILTER} AND event_time >= :s AND event_time < :e AND status_code >= 500
        GROUP BY 1 ORDER BY n DESC LIMIT 8
        """,
        **p,
    )

    book_views = _rows(
        db,
        f"""
        SELECT substring(path FROM '^/api/catalog/books/([0-9]+)/?$')::int AS book_id,
               count(*) AS views,
               count(DISTINCT {VISITOR_KEY}) AS visitors
        FROM events
        WHERE {BASE_FILTER} AND event_time >= :s AND event_time < :e
          AND method = 'GET' AND path ~ '^/api/catalog/books/[0-9]+/?$' AND status_code < 400
        GROUP BY 1 ORDER BY visitors DESC, views DESC LIMIT 10
        """,
        **p,
    )
    downloads = _one(
        db,
        f"""
        SELECT count(*) AS n FROM events
        WHERE {BASE_FILTER} AND event_time >= :s AND event_time < :e
          AND path ~ '^/api/catalog/books/[0-9]+/(download|file)' AND status_code < 400
        """,
        **p,
    )

    searches_total = _one(
        db,
        f"""
        SELECT count(*) AS n FROM events
        WHERE {BASE_FILTER} AND event_time >= :s AND event_time < :e
          AND (path = '/api/search' OR path = '/api/catalog/books/search')
        """,
        **p,
    )
    top_searches = _rows(
        db,
        f"""
        SELECT lower(trim(COALESCE(meta->'request'->'query'->>'q', meta->'request'->'query'->>'query'))) AS q,
               count(*) AS n
        FROM events
        WHERE {BASE_FILTER} AND event_time >= :s AND event_time < :e
          AND (path = '/api/search' OR path = '/api/catalog/books/search')
          AND COALESCE(meta->'request'->'query'->>'q', meta->'request'->'query'->>'query') IS NOT NULL
        GROUP BY 1 HAVING lower(trim(COALESCE(meta->'request'->'query'->>'q', meta->'request'->'query'->>'query'))) <> ''
        ORDER BY n DESC LIMIT 15
        """,
        **p,
    )

    # New vs returning users in the range
    nr = _one(
        db,
        f"""
        WITH active AS (
            SELECT DISTINCT user_id FROM events
            WHERE {BASE_FILTER} AND user_id IS NOT NULL AND event_time >= :s AND event_time < :e
        ), firsts AS (
            SELECT e.user_id, min(e.event_time) AS first_seen
            FROM events e JOIN active a ON a.user_id = e.user_id
            GROUP BY e.user_id
        )
        SELECT count(*) FILTER (WHERE first_seen >= :s) AS new_users,
               count(*) FILTER (WHERE first_seen < :s)  AS returning_users
        FROM firsts
        """,
        **p,
    )

    top_users = _rows(
        db,
        f"""
        SELECT user_id,
               count(*) AS events,
               count(DISTINCT session_id) AS sessions,
               count(DISTINCT date(timezone(:tz, event_time))) AS active_days,
               max(event_time) AS last_seen
        FROM events
        WHERE {BASE_FILTER} AND user_id IS NOT NULL AND event_time >= :s AND event_time < :e
        GROUP BY user_id
        ORDER BY active_days DESC, sessions DESC, events DESC
        LIMIT 10
        """,
        **p,
    )

    # Weekly retention cohorts (8 weeks ending at the end of the range)
    cohort_start = end - timedelta(weeks=8)
    cohort_rows = _rows(
        db,
        f"""
        WITH firsts AS (
            SELECT user_id, date_trunc('week', timezone(:tz, min(event_time)))::date AS cohort
            FROM events
            WHERE {BASE_FILTER} AND user_id IS NOT NULL AND event_time < :e
            GROUP BY user_id
            HAVING min(event_time) >= :cs
        ), act AS (
            SELECT DISTINCT user_id, date_trunc('week', timezone(:tz, event_time))::date AS wk
            FROM events
            WHERE {BASE_FILTER} AND user_id IS NOT NULL AND event_time >= :cs AND event_time < :e
        )
        SELECT f.cohort, ((a.wk - f.cohort) / 7)::int AS week_n, count(DISTINCT a.user_id) AS users
        FROM firsts f JOIN act a ON a.user_id = f.user_id
        GROUP BY 1, 2 ORDER BY 1, 2
        """,
        tz=tz,
        e=end,
        cs=cohort_start,
    )
    cohorts_map: dict[date, dict[int, int]] = defaultdict(dict)
    for r in cohort_rows:
        cohorts_map[r["cohort"]][int(r["week_n"])] = int(r["users"])
    cohorts = []
    for cohort, weeks in sorted(cohorts_map.items()):
        size = weeks.get(0, 0)
        if not size:
            continue
        cohorts.append(
            {
                "cohort": cohort.isoformat(),
                "size": size,
                "retention": [round(100 * weeks.get(i, 0) / size, 1) for i in range(0, max(weeks) + 1)],
            }
        )

    return {
        "range": {
            "from": local_start.isoformat(),
            "to": local_end.isoformat(),
            "prev_from": prev_start.astimezone(get_tz()).date().isoformat(),
            "prev_to": (prev_end - timedelta(seconds=1)).astimezone(get_tz()).date().isoformat(),
        },
        "current": current,
        "previous": previous,
        "stickiness": {
            "dau": int(stick.get("dau") or 0),
            "wau": int(stick.get("wau") or 0),
            "mau": int(stick.get("mau") or 0),
            "avg_dau": avg_dau,
            "ratio": round(100 * avg_dau / int(stick.get("mau")), 1) if stick.get("mau") else 0.0,
        },
        "daily": daily_out,
        "heatmap": heatmap,
        "status": status,
        "error_paths": [{"path": r["path"], "count": int(r["n"]), "status": int(r["status"] or 0)} for r in error_paths],
        "devices": _ua_breakdown(db, start, end),
        "top_pages": _referrer_pages(db, start, end),
        "book_views": [
            {"book_id": int(r["book_id"]), "views": int(r["views"]), "visitors": int(r["visitors"])} for r in book_views
        ],
        "downloads": int(downloads.get("n") or 0),
        "searches": {
            "total": int(searches_total.get("n") or 0),
            "top": [{"query": r["q"], "count": int(r["n"])} for r in top_searches],
        },
        "users": {
            "new": int(nr.get("new_users") or 0),
            "returning": int(nr.get("returning_users") or 0),
            "top": [
                {
                    "user_id": int(r["user_id"]),
                    "events": int(r["events"]),
                    "sessions": int(r["sessions"]),
                    "active_days": int(r["active_days"]),
                    "last_seen": r["last_seen"],
                }
                for r in top_users
            ],
        },
        "cohorts": cohorts,
    }


# --------------------------------------------------------------------------- #
# Personal activity (any signed-in user, only their own data)
# --------------------------------------------------------------------------- #


@router.get("/me/activity")
def my_activity(
    days: int = Query(30, ge=7, le=180),
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tz = get_tz()
    today = datetime.now(tz).date()
    start, end = range_for_dates(today - timedelta(days=days - 1), today)
    uid = user.user_id
    p = {"s": start, "e": end, "tz": settings.TIMEZONE, "uid": uid}

    summary = _summary(db, start, end, user_id=uid)
    daily = _rows(
        db,
        f"""
        SELECT date(timezone(:tz, event_time)) AS day, count(*) AS events, count(DISTINCT session_id) AS sessions
        FROM events
        WHERE {BASE_FILTER} AND user_id = :uid AND event_time >= :s AND event_time < :e
        GROUP BY 1 ORDER BY 1
        """,
        **p,
    )
    by_day = {r["day"]: r for r in daily}
    daily_out = []
    for i in range(days):
        d = today - timedelta(days=days - 1 - i)
        r = by_day.get(d, {})
        daily_out.append({"day": d.isoformat(), "events": int(r.get("events") or 0), "sessions": int(r.get("sessions") or 0)})

    hourly_rows = _rows(
        db,
        f"""
        SELECT extract(hour FROM timezone(:tz, event_time))::int AS hour, count(DISTINCT session_id) AS sessions
        FROM events
        WHERE {BASE_FILTER} AND user_id = :uid AND event_time >= :s AND event_time < :e
        GROUP BY 1
        """,
        **p,
    )
    hourly = [0] * 24
    for r in hourly_rows:
        hourly[int(r["hour"])] = int(r["sessions"] or 0)

    last_seen = _one(
        db,
        f"SELECT max(event_time) AS ts FROM events WHERE {BASE_FILTER} AND user_id = :uid",
        uid=uid,
    ).get("ts")

    ua_rows = _rows(
        db,
        f"""
        SELECT user_agent, max(event_time) AS last_seen, count(*) AS events
        FROM events
        WHERE {BASE_FILTER} AND user_id = :uid AND event_time >= :s AND event_time < :e
        GROUP BY user_agent ORDER BY last_seen DESC LIMIT 50
        """,
        **p,
    )
    devices: dict[tuple[str, str, str], dict] = {}
    for r in ua_rows:
        parsed = parse_user_agent(r["user_agent"])
        if parsed["device"] == "bot":
            continue
        key = (parsed["device"], parsed["browser"], parsed["os"])
        if key not in devices:
            devices[key] = {**parsed, "last_seen": r["last_seen"], "events": 0}
        devices[key]["events"] += int(r["events"] or 0)

    return {
        "range": {"from": (today - timedelta(days=days - 1)).isoformat(), "to": today.isoformat(), "days": days},
        "events": summary["events"],
        "sessions": summary["sessions"],
        "active_days": sum(1 for r in daily_out if r["events"] > 0),
        "last_seen": last_seen,
        "daily": daily_out,
        "hourly": hourly,
        "peak_hour": max(range(24), key=lambda h: hourly[h]) if any(hourly) else None,
        "devices": list(devices.values())[:5],
    }
