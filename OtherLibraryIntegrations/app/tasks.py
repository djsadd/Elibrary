import asyncio

from app.celeryconfig import celery
from app.services.migrate_subjects_service import run_subjects_migration


@celery.task(name="otherlibraryintegrations.migrate_subjects")
def migrate_subjects_task(pending_items: list[dict], token: str) -> dict:
    return asyncio.run(run_subjects_migration(pending_items, token))
