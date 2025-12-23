import logging

from fastapi import APIRouter, Query, Depends
from app.services.external_service import ExternalLibraryService, ExternalLibraryServiceSubjects
from app.services.sync_service import LibrarySyncService, LibrarySyncServiceSubjects
from sqlalchemy import select
from app.core.db import SessionLocal
from app.models.libtau import Library, LibraryWithSubjects
from sqlalchemy.orm import Session
from app.utils.authz import get_current_user
from app.schemas.library_with_subjects import LibraryWithSubjectsOut

from celery.result import AsyncResult
from app.celeryconfig import celery
from app.tasks import migrate_subjects_task

router = APIRouter(prefix="/libtau", tags=["Library Integration"])

external_service = ExternalLibraryService()
sync_service = LibrarySyncService(external_service)


external_service_subjects = ExternalLibraryServiceSubjects()
sync_service_subjects = LibrarySyncServiceSubjects(external_service_subjects)

PENDING_SUBJECTS = []
PENDING_MIGRATION_SUBJECTS = []
MIGRATION_TASK_ID = None

logger = logging.getLogger("migrate_subjects")
logger.setLevel(logging.DEBUG)


def get_db():
    with SessionLocal() as session:
        yield session


@router.get("/books")
def get_library_books(
    skip: int = Query(0, ge=0, description="Количество пропускаемых записей"),
    limit: int = Query(10, ge=1, le=100, description="Максимальное количество записей"),
    db: Session = Depends(get_db)
):
    """
    Возвращает книги из библиотеки с пагинацией
    """
    # Получаем общее количество
    total = db.query(Library).count()

    # Получаем сами книги с применением skip и limit
    stmt = select(Library).offset(skip).limit(limit)
    result = db.execute(stmt).scalars().all()

    books = []
    for book in result:
        books.append({
            "pdf_id": book.pdf_id,
            "title": book.title,
            "download_url": book.download_url,
            "book_id": book.book_id,
            "file_is_indexed": book.file_is_indexed,
            "title_is_indexed": book.title_is_indexed,
            "is_integrated": book.is_integrated,
            "timestamp": book.timestamp
        })

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "books": books
    }


@router.get("/crawl_pdfs")
async def fetch_pdfs():
    global PENDING_SUBJECTS
    sync_result = sync_service_subjects.sync_library_books(apply_changes=True)
    PENDING_SUBJECTS = sync_result["books"]

    return {
        "total": sync_result["total"],
        "added": sync_result["added"],
        "updated": sync_result["updated"],
        "skipped_no_pdf_id": sync_result["skipped_no_pdf_id"],
        "preview": sync_result["books"][:50],
        "message": "Предпросмотр готов. Для применения вызывайте /crawl_pdfs/commit, отмена — /crawl_pdfs/cancel."
    }


@router.post("/crawl_pdfs/commit")
def commit_crawl_pdfs(current_user=Depends(get_current_user)):
    global PENDING_SUBJECTS

    if not PENDING_SUBJECTS:
        return {"status": "no_pending", "message": "Нет данных — выполните предварительно /crawl_pdfs"}

    result = sync_service_subjects.sync_library_books(apply_changes=True, rows_override=PENDING_SUBJECTS)
    PENDING_SUBJECTS = []
    return {
        "status": "completed",
        **result,
    }


@router.post("/crawl_pdfs/cancel")
def cancel_crawl_pdfs():
    global PENDING_SUBJECTS
    PENDING_SUBJECTS = []
    return {"status": "cancelled"}


@router.get("", response_model=dict)
def list_library_with_subjects(
    offset: int = Query(0, ge=0, description="Offset"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    db: Session = Depends(get_db)
):
    total = db.query(LibraryWithSubjects).count()
    rows = db.execute(select(LibraryWithSubjects).offset(offset).limit(limit)).scalars().all()
    items = [LibraryWithSubjectsOut.from_orm(row) for row in rows]

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": items
    }


@router.get("/migrate_subjects/preview")
def preview_subjects_migration(db: Session = Depends(get_db)):
    global PENDING_MIGRATION_SUBJECTS

    stmt = select(LibraryWithSubjects).where(LibraryWithSubjects.is_integrated.is_(False))
    rows = db.execute(stmt).scalars().all()

    to_migrate = []
    for row in rows:
        to_migrate.append({
            "id": row.id,
            "title": row.post_title,
            "download_url": row.pdf_url,
            "pdf_id": row.pdf_id,
            "post_id": row.post_id,
            "level": row.level,
            "path_ids": row.path_ids,
            "path_titles": row.path_titles,
        })

    PENDING_MIGRATION_SUBJECTS = to_migrate[:1000]

    return {
        "total": len(to_migrate),
        "preview": to_migrate[:50],
        "message": "Готово. Для выполнения миграции вызовите /migrate_subjects/commit"
    }


@router.post("/migrate_subjects/commit")
def commit_subjects_migration(
    current_user=Depends(get_current_user),
):
    global PENDING_MIGRATION_SUBJECTS, MIGRATION_TASK_ID

    if MIGRATION_TASK_ID:
        task = AsyncResult(MIGRATION_TASK_ID, app=celery)
        if not task.ready():
            return {"status": "in_progress", "task_id": MIGRATION_TASK_ID}
        MIGRATION_TASK_ID = None

    if not PENDING_MIGRATION_SUBJECTS:
        logger.debug("commit_subjects_migration: no pending items")
        return {
            "status": "no_pending",
            "message": "No pending items. Run preview first.",
        }

    items = PENDING_MIGRATION_SUBJECTS
    PENDING_MIGRATION_SUBJECTS = []

    task = migrate_subjects_task.delay(items, current_user.token)
    MIGRATION_TASK_ID = task.id
    logger.info(
        "commit_subjects_migration: queued task_id=%s items=%d",
        task.id,
        len(items),
    )

    return {"status": "queued", "task_id": task.id, "count": len(items)}

@router.post("/migrate_subjects/cancel")
def cancel_subjects_migration():
    global PENDING_MIGRATION_SUBJECTS, MIGRATION_TASK_ID
    PENDING_MIGRATION_SUBJECTS = []
    revoked = False
    if MIGRATION_TASK_ID:
        celery.control.revoke(MIGRATION_TASK_ID, terminate=False)
        MIGRATION_TASK_ID = None
        revoked = True
    return {"status": "cancelled", "task_revoked": revoked}

