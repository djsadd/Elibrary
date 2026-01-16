from __future__ import annotations

import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)


def _book_to_search_doc(book: dict) -> dict:
    def _names(items: list[dict] | None) -> list[str]:
        out: list[str] = []
        for item in items or []:
            name = (item or {}).get("name")
            if name and str(name).strip():
                out.append(str(name).strip())
        return out

    return {
        "id": int(book["id"]),
        "title": str(book.get("title") or ""),
        "authors": _names(book.get("authors")),
        "subjects": _names(book.get("subjects")),
        "lang": book.get("lang"),
        "year": book.get("year"),
        "summary": book.get("summary"),
        "cover": book.get("cover"),
    }


def index_book_in_search(book: dict) -> None:
    base = (settings.SEARCH_SERVICE_URL or "").strip().rstrip("/")
    if not base:
        return

    url = f"{base}/internal/books/index"
    headers: dict[str, str] = {}
    if (settings.SEARCH_ADMIN_TOKEN or "").strip():
        headers["X-Admin-Token"] = settings.SEARCH_ADMIN_TOKEN.strip()

    payload = _book_to_search_doc(book)
    try:
        with httpx.Client(timeout=2.0) as client:
            r = client.post(url, json=payload, headers=headers)
            if r.status_code >= 400:
                log.warning("SearchService index failed: %s %s", r.status_code, r.text[:200])
    except Exception as e:
        log.warning("SearchService index error: %s", e)

