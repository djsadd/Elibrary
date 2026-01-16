from __future__ import annotations

from elasticsearch import AsyncElasticsearch

from app.core.config import settings


def create_es() -> AsyncElasticsearch:
    return AsyncElasticsearch(
        hosts=[str(settings.ELASTIC_URL)],
        request_timeout=settings.ELASTIC_REQUEST_TIMEOUT_S,
    )

