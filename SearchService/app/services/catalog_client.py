from __future__ import annotations

import httpx

from app.core.config import settings


async def fetch_books_page(*, q: str | None, limit: int, offset: int) -> dict:
    params: dict[str, str | int] = {"limit": limit, "offset": offset}
    if q:
        params["q"] = q
    async with httpx.AsyncClient(timeout=settings.CATALOG_TIMEOUT_S) as client:
        r = await client.get(f"{str(settings.CATALOG_SERVICE_URL).rstrip('/')}/catalog/books/search", params=params)
        r.raise_for_status()
        return r.json()


async def fetch_books_batch(*, ids: list[int]) -> list[dict]:
    ids_norm = [int(x) for x in ids if int(x) > 0]
    if not ids_norm:
        return []

    params = {"ids": ",".join(str(x) for x in ids_norm)}
    async with httpx.AsyncClient(timeout=settings.CATALOG_TIMEOUT_S) as client:
        r = await client.get(f"{str(settings.CATALOG_SERVICE_URL).rstrip('/')}/catalog/books/batch", params=params)
        r.raise_for_status()
        payload = r.json()
        return payload if isinstance(payload, list) else []
