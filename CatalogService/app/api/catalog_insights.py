"""Reading insights: activity tracking from the reader, personal stats and library-wide stats."""

import os
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.catalog_common import get_db
from app.models.book import (
    Author,
    Book,
    ReadingActivity,
    Subject,
    UserBook,
    UserBookNote,
    book_authors,
    book_subjects,
)
from app.utils.authz import AuthUser, get_current_user, require_roles

router = APIRouter()

COMPLETED = "readed"
MAX_HEARTBEAT_SECONDS = 15 * 60  # the reader sends a heartbeat at most every minute; cap abuse
MAX_HEARTBEAT_PAGES = 200


def _tz() -> ZoneInfo | None:
    try:
        return ZoneInfo(os.getenv("TIMEZONE", "Asia/Almaty"))
    except Exception:
        return None


def _today() -> date:
    tz = _tz()
    return datetime.now(tz).date() if tz else date.today()


def _is_completed(ub: UserBook) -> bool:
    return (ub.status or "").lower() == COMPLETED or (ub.progress_percent or 0) >= 100


def _date_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _month_keys(end: date, months: int) -> list[str]:
    keys: list[str] = []
    y, m = end.year, end.month
    for _ in range(months):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


def _name_i18n(obj) -> dict:
    return {
        "id": obj.id,
        "name": obj.name,
        "name_ru": getattr(obj, "name_ru", None),
        "name_kk": getattr(obj, "name_kk", None),
        "name_en": getattr(obj, "name_en", None),
    }


def _book_brief(book: Book) -> dict:
    return {
        "id": book.id,
        "title": book.title,
        "authors": [a.name for a in book.authors],
        "year": book.year,
    }


def _streaks(active_days: set[date], today: date) -> tuple[int, int]:
    """Current streak (ending today, or yesterday if nothing yet today) and longest streak."""
    if not active_days:
        return 0, 0
    current = 0
    cursor = today if today in active_days else today - timedelta(days=1)
    while cursor in active_days:
        current += 1
        cursor -= timedelta(days=1)
    longest = run = 0
    prev: date | None = None
    for d in sorted(active_days):
        run = run + 1 if prev is not None and d - prev == timedelta(days=1) else 1
        longest = max(longest, run)
        prev = d
    return current, longest


# --------------------------------------------------------------------------- #
# Reader heartbeat
# --------------------------------------------------------------------------- #


class ActivityIn(BaseModel):
    seconds: int = Field(0, ge=0, le=MAX_HEARTBEAT_SECONDS)
    pages: int = Field(0, ge=0, le=MAX_HEARTBEAT_PAGES)


@router.post("/userbook/{userbook_id}/activity")
def track_reading_activity(
    userbook_id: int,
    payload: ActivityIn,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    userbook = db.get(UserBook, userbook_id)
    if not userbook or userbook.user_id != user.user_id:
        raise HTTPException(404, "UserBook not found")
    if payload.seconds == 0 and payload.pages == 0:
        return {"ok": True}

    today = _today()
    row = (
        db.query(ReadingActivity)
        .filter_by(user_id=user.user_id, book_id=userbook.book_id, day=today)
        .first()
    )
    if not row:
        row = ReadingActivity(user_id=user.user_id, book_id=userbook.book_id, day=today, seconds=0, pages=0)
        db.add(row)
    row.seconds = (row.seconds or 0) + payload.seconds
    row.pages = (row.pages or 0) + payload.pages
    # reading_time is stored in minutes (that is how the profile and admin pages read it)
    userbook.reading_time = round((userbook.reading_time or 0.0) + payload.seconds / 60.0, 2)
    db.commit()
    return {"ok": True, "reading_time": userbook.reading_time}


# --------------------------------------------------------------------------- #
# Personal insights
# --------------------------------------------------------------------------- #


@router.get("/me/insights")
def my_insights(
    days: int = Query(365, ge=7, le=366),
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = _today()
    start = today - timedelta(days=days - 1)
    uid = user.user_id

    userbooks = db.query(UserBook).filter(UserBook.user_id == uid).all()
    acts = (
        db.query(ReadingActivity)
        .filter(ReadingActivity.user_id == uid, ReadingActivity.day >= start)
        .all()
    )
    total_pages_all = (
        db.query(func.coalesce(func.sum(ReadingActivity.pages), 0)).filter(ReadingActivity.user_id == uid).scalar()
    )
    all_days = {
        d for (d,) in db.query(ReadingActivity.day).filter(ReadingActivity.user_id == uid).distinct().all()
    }
    notes_total = db.query(func.count(UserBookNote.id)).filter(UserBookNote.user_id == uid).scalar() or 0

    per_day_sec: dict[date, int] = defaultdict(int)
    per_day_pages: dict[date, int] = defaultdict(int)
    per_book_sec: dict[int, int] = defaultdict(int)
    for a in acts:
        per_day_sec[a.day] += a.seconds or 0
        per_day_pages[a.day] += a.pages or 0
        per_book_sec[a.book_id] += a.seconds or 0

    daily = [
        {"day": d.isoformat(), "minutes": round(per_day_sec.get(d, 0) / 60, 1), "pages": per_day_pages.get(d, 0)}
        for d in _date_range(start, today)
    ]

    weekday = [0.0] * 7
    for d, sec in per_day_sec.items():
        weekday[d.weekday()] += sec / 60
    monthly_map: dict[str, float] = defaultdict(float)
    for d, sec in per_day_sec.items():
        monthly_map[f"{d.year:04d}-{d.month:02d}"] += sec / 60
    monthly = [{"month": k, "minutes": round(monthly_map.get(k, 0.0), 1)} for k in _month_keys(today, 12)]

    current_streak, longest_streak = _streaks(all_days, today)

    subjects = Counter()
    authors = Counter()
    subject_obj: dict[int, Subject] = {}
    author_obj: dict[int, Author] = {}
    langs = Counter()
    in_progress = []
    completed = reading = 0
    progress_values = []
    for ub in userbooks:
        book = ub.book
        if not book:
            continue
        if _is_completed(ub):
            completed += 1
        elif (ub.status or "reading").lower() == "reading":
            reading += 1
        if ub.progress_percent is not None:
            progress_values.append(float(ub.progress_percent))
        for s in book.subjects:
            subjects[s.id] += 1
            subject_obj[s.id] = s
        for a in book.authors:
            authors[a.id] += 1
            author_obj[a.id] = a
        if book.lang:
            langs[book.lang] += 1
        if not _is_completed(ub):
            in_progress.append(
                {
                    **_book_brief(book),
                    "userbook_id": ub.id,
                    "progress": round(float(ub.progress_percent or 0), 1),
                    "current_page": ub.current_page,
                    "total_pages": ub.total_pages,
                    "minutes": round(float(ub.reading_time or 0), 1),
                    "last_opened_at": ub.last_opened_at,
                }
            )
    in_progress.sort(key=lambda x: x["last_opened_at"] or datetime.min, reverse=True)

    window_minutes = sum(per_day_sec.values()) / 60
    active_days_window = sum(1 for v in per_day_sec.values() if v > 0)
    last30_start = today - timedelta(days=29)
    prev30_start = today - timedelta(days=59)
    last30 = sum(v for d, v in per_day_sec.items() if d >= last30_start) / 60
    prev30 = sum(v for d, v in per_day_sec.items() if prev30_start <= d < last30_start) / 60

    best_day = max(per_day_sec.items(), key=lambda kv: kv[1], default=None)

    return {
        "range": {"from": start.isoformat(), "to": today.isoformat(), "days": days},
        "totals": {
            "books": len(userbooks),
            "reading": reading,
            "completed": completed,
            "minutes": round(sum(float(ub.reading_time or 0) for ub in userbooks), 1),
            "pages": int(total_pages_all or 0),
            "notes": int(notes_total),
            "avg_progress": round(sum(progress_values) / len(progress_values), 1) if progress_values else 0.0,
        },
        "window": {
            "minutes": round(window_minutes, 1),
            "active_days": active_days_window,
            "avg_minutes_per_active_day": round(window_minutes / active_days_window, 1) if active_days_window else 0.0,
            "last30_minutes": round(last30, 1),
            "prev30_minutes": round(prev30, 1),
            "best_day": {"day": best_day[0].isoformat(), "minutes": round(best_day[1] / 60, 1)} if best_day else None,
        },
        "streak": {"current": current_streak, "longest": longest_streak, "read_today": today in all_days},
        "daily": daily,
        "weekday_minutes": [round(v, 1) for v in weekday],
        "monthly": monthly,
        "top_subjects": [
            {**_name_i18n(subject_obj[sid]), "count": c} for sid, c in subjects.most_common(6)
        ],
        "top_authors": [{**_name_i18n(author_obj[aid]), "count": c} for aid, c in authors.most_common(6)],
        "languages": [{"key": k, "count": c} for k, c in langs.most_common()],
        "in_progress": in_progress[:6],
    }


# --------------------------------------------------------------------------- #
# Library-wide insights (admin / librarian)
# --------------------------------------------------------------------------- #


_YEAR_RE = re.compile(r"(1[5-9]\d{2}|20\d{2})")


@router.get("/admin/insights", dependencies=[Depends(require_roles("admin", "librarian"))])
def library_insights(
    days: int = Query(30, ge=7, le=366),
    db: Session = Depends(get_db),
):
    today = _today()
    start = today - timedelta(days=days - 1)
    prev_start = start - timedelta(days=days)

    # ---- catalog composition ----
    books = db.query(Book.id, Book.lang, Book.source, Book.formats, Book.year, Book.created_at, Book.is_public).all()
    by_lang = Counter()
    by_source = Counter()
    by_format = Counter()
    by_decade = Counter()
    added = Counter()
    month_keys = _month_keys(today, 12)
    for b in books:
        by_lang[(b.lang or "—")] += 1
        src = getattr(b.source, "value", b.source)
        by_source[str(src or "—")] += 1
        for f in (b.formats or "").split(","):
            if f.strip():
                by_format[f.strip().upper()] += 1
        m = _YEAR_RE.search(b.year or "")
        if m:
            by_decade[f"{int(m.group(1)) // 10 * 10}s"] += 1
        if b.created_at:
            key = f"{b.created_at.year:04d}-{b.created_at.month:02d}"
            added[key] += 1

    # ---- reading activity in window ----
    acts = (
        db.query(ReadingActivity.day, ReadingActivity.user_id, ReadingActivity.book_id, ReadingActivity.seconds, ReadingActivity.pages)
        .filter(ReadingActivity.day >= prev_start)
        .all()
    )
    day_readers: dict[date, set[int]] = defaultdict(set)
    day_sec: dict[date, int] = defaultdict(int)
    day_pages: dict[date, int] = defaultdict(int)
    book_sec: dict[int, int] = defaultdict(int)
    book_readers_window: dict[int, set[int]] = defaultdict(set)
    weekday_sec = [0] * 7
    cur_readers: set[int] = set()
    prev_readers: set[int] = set()
    cur_sec = prev_sec = cur_pages = 0
    for a in acts:
        if a.day >= start:
            day_readers[a.day].add(a.user_id)
            day_sec[a.day] += a.seconds or 0
            day_pages[a.day] += a.pages or 0
            book_sec[a.book_id] += a.seconds or 0
            book_readers_window[a.book_id].add(a.user_id)
            weekday_sec[a.day.weekday()] += a.seconds or 0
            cur_readers.add(a.user_id)
            cur_sec += a.seconds or 0
            cur_pages += a.pages or 0
        else:
            prev_readers.add(a.user_id)
            prev_sec += a.seconds or 0

    daily = [
        {
            "day": d.isoformat(),
            "readers": len(day_readers.get(d, ())),
            "minutes": round(day_sec.get(d, 0) / 60, 1),
            "pages": day_pages.get(d, 0),
        }
        for d in _date_range(start, today)
    ]

    # ---- shelves / funnel ----
    ubs = db.query(UserBook.user_id, UserBook.book_id, UserBook.status, UserBook.progress_percent, UserBook.reading_time, UserBook.started_at).all()
    readers_all = {u.user_id for u in ubs}
    first_start: dict[int, datetime] = {}
    funnel = {"started": 0, "p25": 0, "p50": 0, "p75": 0, "completed": 0}
    per_book = defaultdict(lambda: {"readers": 0, "completed": 0, "progress_sum": 0.0, "minutes": 0.0})
    for u in ubs:
        p = float(u.progress_percent or 0)
        done = (u.status or "").lower() == COMPLETED or p >= 100
        funnel["started"] += 1
        if p >= 25 or done:
            funnel["p25"] += 1
        if p >= 50 or done:
            funnel["p50"] += 1
        if p >= 75 or done:
            funnel["p75"] += 1
        if done:
            funnel["completed"] += 1
        stats = per_book[u.book_id]
        stats["readers"] += 1
        stats["completed"] += 1 if done else 0
        stats["progress_sum"] += 100.0 if done else p
        stats["minutes"] += float(u.reading_time or 0)
        if u.started_at and (u.user_id not in first_start or u.started_at < first_start[u.user_id]):
            first_start[u.user_id] = u.started_at
    start_dt = datetime.combine(start, datetime.min.time())
    new_readers = sum(1 for dt in first_start.values() if dt >= start_dt)
    added_to_shelves = sum(1 for u in ubs if u.started_at and u.started_at >= start_dt)

    top_ids = sorted(per_book, key=lambda bid: (per_book[bid]["readers"], per_book[bid]["minutes"]), reverse=True)[:10]
    trending_ids = sorted(book_sec, key=lambda bid: book_sec[bid], reverse=True)[:10]
    needed = set(top_ids) | set(trending_ids)
    book_map = {b.id: b for b in db.query(Book).filter(Book.id.in_(needed)).all()} if needed else {}

    top_books = []
    for bid in top_ids:
        if bid not in book_map:
            continue
        s = per_book[bid]
        top_books.append(
            {
                **_book_brief(book_map[bid]),
                "readers": s["readers"],
                "completed": s["completed"],
                "completion_rate": round(100 * s["completed"] / s["readers"], 1) if s["readers"] else 0.0,
                "avg_progress": round(s["progress_sum"] / s["readers"], 1) if s["readers"] else 0.0,
                "minutes": round(s["minutes"], 1),
            }
        )
    trending = [
        {
            **_book_brief(book_map[bid]),
            "minutes": round(book_sec[bid] / 60, 1),
            "readers": len(book_readers_window[bid]),
        }
        for bid in trending_ids
        if bid in book_map and book_sec[bid] > 0
    ]

    # ---- subjects / authors by readers ----
    subj_rows = (
        db.query(Subject, func.count(func.distinct(UserBook.user_id)).label("readers"), func.count(UserBook.id).label("shelves"))
        .join(book_subjects, book_subjects.c.subject_id == Subject.id)
        .join(UserBook, UserBook.book_id == book_subjects.c.book_id)
        .group_by(Subject.id)
        .order_by(func.count(func.distinct(UserBook.user_id)).desc())
        .limit(10)
        .all()
    )
    auth_rows = (
        db.query(Author, func.count(func.distinct(UserBook.user_id)).label("readers"), func.count(UserBook.id).label("shelves"))
        .join(book_authors, book_authors.c.author_id == Author.id)
        .join(UserBook, UserBook.book_id == book_authors.c.book_id)
        .group_by(Author.id)
        .order_by(func.count(func.distinct(UserBook.user_id)).desc())
        .limit(10)
        .all()
    )

    opened_ids = {u.book_id for u in ubs}
    public_ids = [b.id for b in books if b.is_public]
    never_opened = sum(1 for bid in public_ids if bid not in opened_ids)

    notes_total = db.query(func.count(UserBookNote.id)).scalar() or 0
    notes_window = db.query(func.count(UserBookNote.id)).filter(UserBookNote.created_at >= start_dt).scalar() or 0

    def ranked(counter: Counter, limit: int | None = None) -> list[dict]:
        return [{"key": k, "count": c} for k, c in counter.most_common(limit)]

    return {
        "range": {"from": start.isoformat(), "to": today.isoformat(), "days": days},
        "kpi": {
            "active_readers": len(cur_readers),
            "active_readers_prev": len(prev_readers),
            "minutes": round(cur_sec / 60, 1),
            "minutes_prev": round(prev_sec / 60, 1),
            "pages": cur_pages,
            "new_readers": new_readers,
            "added_to_shelves": added_to_shelves,
            "readers_total": len(readers_all),
            "avg_minutes_per_reader": round(cur_sec / 60 / len(cur_readers), 1) if cur_readers else 0.0,
            "completion_rate": round(100 * funnel["completed"] / funnel["started"], 1) if funnel["started"] else 0.0,
            "notes_total": int(notes_total),
            "notes_window": int(notes_window),
        },
        "catalog": {
            "total": len(books),
            "public": len(public_ids),
            "never_opened": never_opened,
            "coverage": round(100 * (len(public_ids) - never_opened) / len(public_ids), 1) if public_ids else 0.0,
            "by_lang": ranked(by_lang),
            "by_source": ranked(by_source),
            "by_format": ranked(by_format),
            "by_decade": sorted(ranked(by_decade), key=lambda r: r["key"]),
            "added_monthly": [{"month": k, "count": added.get(k, 0)} for k in month_keys],
        },
        "daily": daily,
        "weekday_minutes": [round(s / 60, 1) for s in weekday_sec],
        "funnel": funnel,
        "top_books": top_books,
        "trending_books": trending,
        "top_subjects": [{**_name_i18n(s), "readers": int(r), "shelves": int(sh)} for s, r, sh in subj_rows],
        "top_authors": [{**_name_i18n(a), "readers": int(r), "shelves": int(sh)} for a, r, sh in auth_rows],
    }
