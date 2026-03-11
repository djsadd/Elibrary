from __future__ import annotations

from elasticsearch import NotFoundError
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.config import settings
from app.core.es import create_es
from app.core.security import require_admin_token
from app.schemas.books import (
    BookDoc,
    BookRecommendationExplanationRequest,
    BookRecommendationExplanationResponse,
    SearchResponse,
    SuggestItem,
    SuggestResponse,
)
from app.services.books_index import book_to_es_doc, books_index_body, clamp_limit, es_books_index
from app.services.catalog_client import fetch_books_batch, fetch_books_page
from app.services.llm import fallback_explanation, generate_book_explanation

router = APIRouter(tags=["search"])


def _es_fields(prefix_boost: bool) -> list[str]:
    base = [
        "title^4",
        "title._2gram^3",
        "title._3gram^2",
        "authors^2",
        "authors._2gram",
        "authors._3gram",
        "subjects",
        "subjects._2gram",
        "subjects._3gram",
    ]
    if prefix_boost:
        return base
    return ["title^4", "authors^2", "subjects"]


@router.get("/search", response_model=SearchResponse)
@router.get("/api/search", response_model=SearchResponse)
async def search(
    request: Request,
    q: str | None = None,
    lang: str | None = None,
    year: str | None = None,
    limit: int = Query(default=settings.SEARCH_DEFAULT_LIMIT, ge=1, le=settings.SEARCH_MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
):
    es = create_es()
    try:
        must: list[dict] = []
        filters: list[dict] = []

        if q and q.strip():
            must.append(
                {
                    "multi_match": {
                        "query": q.strip(),
                        "type": "bool_prefix",
                        "fields": _es_fields(prefix_boost=True),
                        "operator": "and",
                    }
                }
            )
        else:
            must.append({"match_all": {}})

        if lang:
            filters.append({"term": {"lang": lang}})
        if year:
            filters.append({"term": {"year": year}})

        query = {"bool": {"must": must, "filter": filters}} if filters else {"bool": {"must": must}}

        idx = es_books_index()
        resp = await es.search(
            index=idx,
            query=query,
            from_=offset,
            size=limit,
            sort=[{"_score": "desc"}, {"popularity": "desc"}, {"title_raw": "asc"}],
            track_total_hits=True,
        )
        total = int(resp["hits"]["total"]["value"])

        hits = resp["hits"]["hits"] or []
        hit_docs: list[dict] = [h.get("_source") or {} for h in hits]
        hit_ids: list[int] = []
        for d in hit_docs:
            try:
                hit_ids.append(int(d.get("id")))
            except Exception:
                continue

        items: list[BookDoc] = []
        try:
            enriched = await fetch_books_batch(ids=hit_ids)
            by_id = {int(b.get("id")): b for b in (enriched or []) if isinstance(b, dict) and b.get("id") is not None}
            for d in hit_docs:
                try:
                    bid = int(d.get("id"))
                except Exception:
                    items.append(BookDoc(**d))
                    continue
                payload = by_id.get(bid)
                if payload is None:
                    items.append(BookDoc(**d))
                else:
                    items.append(BookDoc.from_catalog(payload))
        except Exception:
            items = [BookDoc(**d) for d in hit_docs]

        return SearchResponse(items=items, page={"limit": limit, "offset": offset, "total": total})
    except NotFoundError:
        raise HTTPException(status_code=503, detail="Search index not initialized")
    finally:
        await es.close()


@router.get("/search/suggest", response_model=SuggestResponse)
@router.get("/api/search/suggest", response_model=SuggestResponse)
async def suggest(
    q: str = Query(..., min_length=1),
    lang: str | None = None,
    limit: int = Query(default=settings.SUGGEST_DEFAULT_LIMIT, ge=1, le=settings.SUGGEST_MAX_LIMIT),
):
    es = create_es()
    try:
        filters: list[dict] = []
        if lang:
            filters.append({"term": {"lang": lang}})

        idx = es_books_index()
        resp = await es.search(
            index=idx,
            query={
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": q.strip(),
                                "type": "bool_prefix",
                                "fields": _es_fields(prefix_boost=True),
                            }
                        }
                    ],
                    "filter": filters,
                }
            },
            size=limit,
            _source=["id", "title", "authors"],
        )
        items = [
            SuggestItem(
                id=int(h["_source"]["id"]),
                title=str(h["_source"].get("title") or ""),
                authors=list(h["_source"].get("authors") or []),
            )
            for h in resp["hits"]["hits"]
        ]
        return SuggestResponse(q=q, items=items)
    except NotFoundError:
        raise HTTPException(status_code=503, detail="Search index not initialized")
    finally:
        await es.close()


@router.post("/search/book-recommendation-explanation", response_model=BookRecommendationExplanationResponse)
@router.post("/api/search/book-recommendation-explanation", response_model=BookRecommendationExplanationResponse)
async def book_recommendation_explanation(payload: BookRecommendationExplanationRequest):
    try:
        explanation, model, source = await generate_book_explanation(
            book=payload.book,
            student_query=payload.student_query,
            student_profile=payload.student_profile,
        )
        return BookRecommendationExplanationResponse(explanation=explanation, model=model, source=source)
    except Exception:
        return BookRecommendationExplanationResponse(
            explanation=fallback_explanation(payload.book, payload.student_query, payload.student_profile),
            model=settings.OPENAI_MODEL or None,
            source="fallback",
        )


@router.post("/admin/init_index", dependencies=[Depends(require_admin_token)])
@router.post("/api/admin/init_index", dependencies=[Depends(require_admin_token)])
async def admin_init_index():
    es = create_es()
    try:
        idx = es_books_index()
        exists = await es.indices.exists(index=idx)
        if not exists:
            await es.indices.create(index=idx, **books_index_body())
        return {"ok": True, "index": idx}
    finally:
        await es.close()


@router.post("/admin/reset_index", dependencies=[Depends(require_admin_token)])
@router.post("/api/admin/reset_index", dependencies=[Depends(require_admin_token)])
async def admin_reset_index():
    es = create_es()
    try:
        idx = es_books_index()
        exists = await es.indices.exists(index=idx)
        if exists:
            await es.indices.delete(index=idx)
        await es.indices.create(index=idx, **books_index_body())
        return {"ok": True, "index": idx, "reset": True}
    finally:
        await es.close()


@router.post("/admin/reindex", dependencies=[Depends(require_admin_token)])
@router.post("/api/admin/reindex", dependencies=[Depends(require_admin_token)])
async def admin_reindex():
    es = create_es()
    try:
        idx = es_books_index()
        exists = await es.indices.exists(index=idx)
        if not exists:
            await es.indices.create(index=idx, **books_index_body())

        offset = 0
        limit = 100
        total_seen = 0
        total_indexed = 0
        total_failed = 0
        first_error: dict | None = None

        while True:
            payload = await fetch_books_page(q=None, limit=limit, offset=offset)
            items = payload.get("items") or []
            if not items:
                break

            operations: list[dict] = []
            for raw in items:
                doc = BookDoc.from_catalog(raw).model_dump()
                doc = book_to_es_doc(doc)
                operations.append({"index": {"_index": idx, "_id": str(doc["id"])}})
                operations.append(doc)

            bulk_resp = await es.bulk(operations=operations, refresh=False)
            total_seen += len(items)

            if bulk_resp.get("errors"):
                for item in bulk_resp.get("items", []):
                    op = item.get("index") or item.get("create") or item.get("update") or item.get("delete") or {}
                    if "error" in op:
                        total_failed += 1
                        if first_error is None:
                            first_error = op.get("error")
                    else:
                        total_indexed += 1
            else:
                total_indexed += len(items)

            offset += len(items)

            page = payload.get("page") or {}
            total = int(page.get("total") or 0)
            if total and offset >= total:
                break

        await es.indices.refresh(index=idx)
        return {"ok": True, "seen": total_seen, "indexed": total_indexed, "failed": total_failed, "first_error": first_error}
    finally:
        await es.close()


@router.post("/internal/books/index", dependencies=[Depends(require_admin_token)])
@router.post("/api/internal/books/index", dependencies=[Depends(require_admin_token)])
async def internal_index_book(book: BookDoc):
    es = create_es()
    try:
        idx = es_books_index()
        doc = book_to_es_doc(book.model_dump())
        await es.index(index=idx, id=str(book.id), document=doc, refresh=False)
        return {"ok": True}
    finally:
        await es.close()


@router.delete("/internal/books/{book_id}", dependencies=[Depends(require_admin_token)])
@router.delete("/api/internal/books/{book_id}", dependencies=[Depends(require_admin_token)])
async def internal_delete_book(book_id: int):
    es = create_es()
    try:
        idx = es_books_index()
        try:
            await es.delete(index=idx, id=str(book_id), refresh=False)
        except NotFoundError:
            pass
        return {"ok": True}
    finally:
        await es.close()
