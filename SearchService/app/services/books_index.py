from __future__ import annotations

from app.core.config import settings


def books_index_body() -> dict:
    return {
        "settings": {
            "index": {"number_of_shards": 1, "number_of_replicas": 0},
            "analysis": {
                "normalizer": {
                    "lowercase_normalizer": {
                        "type": "custom",
                        "filter": ["lowercase", "asciifolding"],
                    }
                }
            },
        },
        "mappings": {
            "dynamic": "strict",
            "properties": {
                "id": {"type": "integer"},
                "title": {"type": "search_as_you_type"},
                "title_raw": {"type": "keyword", "normalizer": "lowercase_normalizer"},
                "authors": {"type": "search_as_you_type"},
                "subjects": {"type": "search_as_you_type"},
                "lang": {"type": "keyword"},
                "year": {"type": "keyword"},
                "summary": {"type": "text"},
                # cover may be a huge base64 data-url; ignore long values to prevent indexing failures
                "cover": {"type": "keyword", "index": False, "ignore_above": 512},
                "popularity": {"type": "integer"},
            },
        },
    }


def book_to_es_doc(book: dict) -> dict:
    doc = dict(book)
    doc["title_raw"] = str(doc.get("title") or "")

    for key in ("lang", "year"):
        if doc.get(key) is None:
            continue
        v = str(doc.get(key)).strip()
        doc[key] = v or None

    cover = doc.get("cover")
    if cover is not None:
        cover_s = str(cover)
        if len(cover_s) > 512:
            doc["cover"] = None
        else:
            doc["cover"] = cover_s

    summary = doc.get("summary")
    if summary is not None:
        s = str(summary)
        doc["summary"] = s[:10000] if len(s) > 10000 else s

    return doc


def clamp_limit(limit: int, default: int, max_limit: int) -> int:
    if limit is None:
        return default
    try:
        n = int(limit)
    except Exception:
        return default
    if n < 1:
        return 1
    return min(n, max_limit)


def es_books_index() -> str:
    return settings.ELASTIC_INDEX_BOOKS
