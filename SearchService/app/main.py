from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.api.routes import router
from app.core.config import settings
from app.core.es import create_es
from app.services.books_index import books_index_body, es_books_index
from app.utils.logging_config import setup_logging

log = logging.getLogger(__name__)

setup_logging()

app = FastAPI(title="SearchService", version="0.1.0")
app.state.es_ready = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "search", "elasticsearch_ready": bool(getattr(app.state, "es_ready", False))}


async def _init_index_if_needed() -> None:
    if not settings.INIT_INDEX_ON_START:
        return

    max_attempts = 30  # ~60-90s total depending on backoff
    delay_s = 1.0

    for attempt in range(1, max_attempts + 1):
        es = create_es()
        try:
            idx = es_books_index()
            exists = await es.indices.exists(index=idx)
            if not exists:
                await es.indices.create(index=idx, **books_index_body())
            app.state.es_ready = True
            return
        except Exception as e:
            app.state.es_ready = False
            if attempt == max_attempts:
                log.warning("Elasticsearch not ready after %d attempts: %s", attempt, e)
                return
            log.info("Waiting for Elasticsearch (%d/%d): %s", attempt, max_attempts, e)
            await asyncio.sleep(delay_s)
            delay_s = min(delay_s * 1.5, 5.0)
        finally:
            await es.close()


async def _maybe_reindex() -> None:
    if not settings.REINDEX_ON_START:
        return
    from app.api.search import admin_reindex

    if not bool(getattr(app.state, "es_ready", False)):
        log.warning("Skip REINDEX_ON_START because Elasticsearch is not ready")
        return
    await admin_reindex()


@app.on_event("startup")
async def _startup():
    try:
        await _init_index_if_needed()
        await _maybe_reindex()
    except Exception as e:
        app.state.es_ready = False
        log.warning("Startup completed with degraded search (Elasticsearch unavailable): %s", e)
