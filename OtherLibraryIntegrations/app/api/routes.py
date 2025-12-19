import base64
import logging

import httpx
from fastapi import APIRouter, BackgroundTasks, Query, Depends, HTTPException
from pathlib import Path
from app.services.external_service import ExternalLibraryService, ExternalLibraryServiceSubjects
from app.services.sync_service import LibrarySyncService, LibrarySyncServiceSubjects
from sqlalchemy import select
from app.core.db import SessionLocal
from app.models.libtau import Library, LibraryWithSubjects
from app.core.config import settings
from sqlalchemy.orm import Session
import requests
from typing import List
from app.utils.authz import get_current_user
from app.schemas.library_with_subjects import LibraryWithSubjectsOut

from openai import OpenAI
import json
import aiohttp
import fitz
from io import BytesIO
from PIL import Image

router = APIRouter(prefix="/libtau", tags=["Library Integration"])

external_service = ExternalLibraryService()
sync_service = LibrarySyncService(external_service)


external_service_subjects = ExternalLibraryServiceSubjects()
sync_service_subjects = LibrarySyncServiceSubjects(external_service_subjects)

PENDING_SUBJECTS = []
PENDING_MIGRATION = []
PENDING_MIGRATION_SUBJECTS = []

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

    PENDING_MIGRATION_SUBJECTS = to_migrate[:20]

    return {
        "total": len(to_migrate),
        "preview": to_migrate[:50],
        "message": "Готово. Для выполнения миграции вызовите /migrate_subjects/commit"
    }


client = OpenAI(api_key=settings.OPENAI_API_KEY)  # сюда потом вставишь ключ


async def extract_cover_from_pdf(pdf_bytes: bytes, max_size_kb=150) -> bytes:
    """
    Берёт первую страницу PDF, рендерит в JPEG, сжимает до max_size_kb.
    Возвращает byte[] JPEG.
    """
    pdf = fitz.open(stream=pdf_bytes, filetype="pdf")

    page = pdf.load_page(0)
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x увеличенный DPI

    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

    quality = 85
    buffer = BytesIO()

    while quality > 20:
        buffer.seek(0)
        buffer.truncate()

        img.save(buffer, format="JPEG", quality=quality)
        size_kb = buffer.tell() / 1024

        if size_kb <= max_size_kb:
            break

        quality -= 5

    return buffer.getvalue()


async def upload_file_to_raw_service(
    file_url: str = None,
    filename: str = None,
    token: str = None,
    data: bytes = None
):
    """
    Загружает файл на сервис /upload/raw.
    Если передан file_url → скачивает.
    Если передан data → отправляет как файл.
    """
    if data is None:
        # нужно скачать файл
        if not file_url:
            raise Exception("file_url or data must be provided")

        async with aiohttp.ClientSession() as session:
            async with session.get(file_url) as resp:
                if resp.status != 200:
                    raise Exception(f"Cannot download file: {resp.status}")
                data = await resp.read()

    headers = {"x-filename": filename}

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{settings.CATALOG_SERVICE_URL}/upload/raw",
            data=data,
            headers=headers
        ) as upload_resp:

            if upload_resp.status != 200:
                text = await upload_resp.text()
                raise Exception(f"Upload failed: {text}")

            return await upload_resp.json()

import json
def parse_author_title(text: str) -> dict:
    if not text:
        return {"authors": [], "title": ""}

    raw = text.strip()

    prompt = (
        "Разбей заголовок книги на авторов и название.\n"
        "Верни ответ строго в JSON:\n"
        '{"authors": ["автор1"], "title": "название"}\n'
        "Никакого markdown, никаких ```json, только чистый JSON.\n"
        f"Заголовок: {raw}"
    )

    try:
        print("client - ", client)

        response = client.responses.create(
            model="gpt-4.1-mini",
            input=prompt,
        )

        # Берём текст
        content = response.output[0].content[0]
        text_obj = getattr(content, "text", content)
        result_text = getattr(text_obj, "value", str(text_obj)).strip()

        # Сюда добавил лог для дебага
        print("\n=== RAW RESULT_TEXT ===")
        print(result_text)
        print("=======================\n")

        # ВЫТАСКИВАЕМ JSON ИЗ ЛЮБОГО ДЕРЬМА
        cleaned = extract_json(result_text)

        print("=== CLEANED JSON ===")
        print(cleaned)
        print("====================\n")

        data = json.loads(cleaned)

        authors = data.get("authors") or []
        title = data.get("title") or raw

        if not isinstance(authors, list):
            authors = [str(authors)]

        authors = [str(a).strip() for a in authors if str(a).strip()]

        return {"authors": authors, "title": title}

    except Exception as e:
        print("Error:", e)
        return {"authors": [], "title": raw}


import re
import json

def extract_json(text: str) -> str:
    """
    Ищет JSON-объект в любом тексте. Находит самый первый { ... }.
    Работает даже если вокруг куча мусора.
    """
    # Находим первый блок {...}
    matches = re.findall(r'\{.*?\}', text, flags=re.DOTALL)
    if not matches:
        raise ValueError("JSON object not found in text")
    return matches[0]



@router.post("/migrate_subjects/commit")
async def commit_subjects_migration(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user)
):
    global PENDING_MIGRATION_SUBJECTS

    if not PENDING_MIGRATION_SUBJECTS:
        logger.debug("commit_subjects_migration: no pending items")
        return {
            "status": "no_pending",
            "message": "Нет данных для миграции — выполните preview",
        }
    migrated = 0
    errors = []
    created_items = []

    token = current_user.token
    headers = {"Authorization": f"Bearer {token}"}

    grouped_items = {}
    for item in PENDING_MIGRATION_SUBJECTS:
        key = item.get("pdf_id") or item.get("download_url") or str(item["id"])
        grouped_items.setdefault(key, []).append(item)

    logger.info(
        "commit_subjects_migration: grouped_items=%d (by pdf_id/download_url)",
        len(grouped_items),
    )
    logger.debug(
        "commit_subjects_migration: total_pending=%d",
        len(PENDING_MIGRATION_SUBJECTS),
    )

    for group_key, items in grouped_items.items():
        if migrated >= 20:
            logger.debug("commit_subjects_migration: batch limit reached (20)")
            break

        main_item = items[0]
        row = db.get(LibraryWithSubjects, main_item["id"])
        if not row or row.is_integrated:
            logger.debug(
                "commit_subjects_migration: skip id=%s exists=%s integrated=%s",
                main_item["id"],
                bool(row),
                bool(row and row.is_integrated),
            )
            continue

        subjects_set = set()
        for gi in items:
            gi_row = db.get(LibraryWithSubjects, gi["id"])
            if not gi_row or not gi_row.path_titles:
                continue
            for s in gi_row.path_titles.split("/")[:-1]:
                s = s.strip()
                if s:
                    subjects_set.add(s)

        subjects_list = sorted(subjects_set) if subjects_set else []

        parsed = parse_author_title(row.post_title)
        print(parsed)
        authors_list = parsed["authors"]
        book_title = parsed["title"]
        logger.debug(
            "commit_subjects_migration: id=%s title=%s authors=%s subjects=%s pdf_id=%s",
            row.id,
            book_title,
            authors_list,
            subjects_list,
            row.pdf_id,
        )

        language = None
        if subjects_list:
            first = subjects_list[0].lower()
            if first in ["english", "английский"]:
                language = "English"
            elif first in ["русский", "русский язык", "russian"]:
                language = "Russian"
            elif first in ["қазақша", "казахский", "kazakh"]:
                language = "Kazakh"

        try:
            upload_result = await upload_file_to_raw_service(
                row.pdf_url,
                f"{book_title}.pdf",
                token,
            )
            file_id = upload_result["file"]["file_id"]
            download_url = upload_result["file"]["download_url"]
            logger.debug(
                "commit_subjects_migration: upload ok id=%s file_id=%s download_url=%s",
                row.id,
                file_id,
                download_url,
            )

            async with aiohttp.ClientSession() as session:
                async with session.get(row.pdf_url) as resp:
                    pdf_bytes = await resp.read()

            cover_bytes = await extract_cover_from_pdf(pdf_bytes)
            cover_base64 = (
                "data:image/jpeg;base64,"
                + base64.b64encode(cover_bytes).decode()
            )
            logger.debug(
                "commit_subjects_migration: cover extracted id=%s size=%d",
                row.id,
                len(cover_base64),
            )
        except Exception as e:
            errors.append({"id": row.id, "error": f"Upload failed: {e}"})
            logger.exception(
                "commit_subjects_migration: upload/cover failed id=%s error=%s",
                row.id,
                e,
            )
            continue

        payload = {
            "title": book_title,
            "authors": authors_list,
            "subjects": subjects_list,
            "summary": None,
            "year": None,
            "lang": language,
            "cover": cover_base64,
            "file_id": file_id,
            "pub_info": None,
            "download_url": download_url,
            "formats": ["EBOOK", "HARDCOPY"],
            "isbn": None,
            "edition": None,
            "page_count": None,
            "available_copies": 1,
            "is_public": True,
            "source": "LIBRARY",
        }

        try:
            logger.debug(
                "commit_subjects_migration: sending to catalog id=%s url=%s",
                row.id,
                f"{settings.CATALOG_SERVICE_URL}/books",
            )
            resp = requests.post(
                f"{settings.CATALOG_SERVICE_URL}/books",
                json=payload,
                headers=headers,
                timeout=500,
            )
            if not (200 <= resp.status_code < 300):
                errors.append({"id": row.id, "error": resp.text})
                logger.error(
                    "commit_subjects_migration: catalog error id=%s status=%s body=%s",
                    row.id,
                    resp.status_code,
                    resp.text,
                )
                continue

            created = resp.json()
            logger.debug(
                "commit_subjects_migration: catalog created id=%s catalog_id=%s",
                row.id,
                created.get("id"),
            )

            for gi in items:
                gi_row = db.get(LibraryWithSubjects, gi["id"])
                if not gi_row:
                    continue
                if hasattr(gi_row, "book_id"):
                    gi_row.book_id = created.get("id")
                gi_row.is_integrated = True
                gi_row.file_is_downloaded = True
                logger.debug(
                    "commit_subjects_migration: marked integrated id=%s catalog_id=%s",
                    gi_row.id,
                    created.get("id"),
                )

            created_items.append(
                {
                    "catalog_book_id": created.get("id"),
                    "library_ids": [gi["id"] for gi in items],
                    "title": book_title,
                    "pdf_id": row.pdf_id,
                    "download_url": download_url,
                    "subjects": subjects_list,
                    "authors": authors_list,
                }
            )

            migrated += 1

        except Exception as e:
            errors.append({"id": row.id, "error": str(e)})
            logger.exception(
                "commit_subjects_migration: request failed id=%s error=%s",
                row.id,
                e,
            )

    db.commit()
    logger.info(
        "commit_subjects_migration: finished, migrated=%d, errors=%d",
        migrated,
        len(errors),
    )
    PENDING_MIGRATION_SUBJECTS = [
        item
        for item in PENDING_MIGRATION_SUBJECTS
        if not db.get(LibraryWithSubjects, item["id"]).is_integrated
    ]

    return {
        "status": "completed",
        "migrated": migrated,
        "errors": errors,
        "items": created_items,
    }


@router.post("/migrate_subjects/cancel")
def cancel_subjects_migration():
    global PENDING_MIGRATION_SUBJECTS
    PENDING_MIGRATION_SUBJECTS = []
    return {"status": "cancelled"}

