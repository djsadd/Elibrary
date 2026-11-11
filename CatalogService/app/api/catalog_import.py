"""Массовый импорт книг из Excel + ZIP с файлами."""
import io
import os
from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy.orm import Session

from app.api.catalog_common import _to_out, get_db
from app.models.book import Book
from app.services.book_import import ImportFormatError, import_books, spool_upload_to_disk
from app.services.search_sync import index_book_in_search
from app.utils.authz import require_roles
from app.utils.storage import media_root

router = APIRouter()

MAX_EXCEL_SIZE = 20 * 1024 * 1024
MAX_ZIP_SIZE = int(os.getenv("MAX_UPLOAD_MB", "200")) * 1024 * 1024


def _form_bool(value: Optional[str], default: bool) -> bool:
    if value is None or not value.strip():
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "да"}


@router.get(
    "/admin/import/books/template",
    dependencies=[Depends(require_roles("editor", "admin", "librarian"))],
)
def download_import_template():
    wb = Workbook()
    ws = wb.active
    ws.title = "Книги"
    ws.append(["№", "Название", "Автор", "Жанры через запятую", "Язык", "Ссылка"])
    ws.append([1, "Пример книги с файлом (в архиве 1.pdf)", "Иванов И. И.; Петров П. П.", "Математика, Учебник", "Russian", ""])
    ws.append([2, "Пример внешней книги", "Smith J.", "Programming", "English", "https://example.com/book/2"])
    for col, width in zip("ABCDEF", (6, 45, 30, 30, 12, 45)):
        ws.column_dimensions[col].width = width
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="books_import_template.xlsx"'},
    )


@router.post(
    "/admin/import/books",
    dependencies=[Depends(require_roles("editor", "admin", "librarian"))],
)
def import_books_from_excel(
    background_tasks: BackgroundTasks,
    excel: UploadFile = File(..., description="Excel .xlsx: №, Название, Автор, Жанры через запятую, Язык, Ссылка"),
    archive: Optional[UploadFile] = File(None, description="ZIP с файлами книг, имя файла = №.pdf"),
    dry_run: Optional[str] = Form(None),
    is_public: Optional[str] = Form(None),
    skip_duplicates: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    # FastAPI считает отсутствующий bool в форме за False, поэтому разбираем сами
    dry_run = _form_bool(dry_run, False)
    is_public = _form_bool(is_public, True)
    skip_duplicates = _form_bool(skip_duplicates, True)
    if not (excel.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(415, "Нужен Excel-файл в формате .xlsx")
    excel_bytes = excel.file.read(MAX_EXCEL_SIZE + 1)
    if len(excel_bytes) > MAX_EXCEL_SIZE:
        raise HTTPException(413, "Excel-файл слишком большой")

    root = media_root()
    root.mkdir(parents=True, exist_ok=True)
    zip_path = None
    try:
        if archive is not None and archive.filename:
            if not archive.filename.lower().endswith(".zip"):
                raise HTTPException(415, "Архив должен быть в формате .zip")
            zip_path = spool_upload_to_disk(archive.file, root, MAX_ZIP_SIZE)

        report = import_books(
            db,
            io.BytesIO(excel_bytes),
            zip_path,
            root,
            dry_run=dry_run,
            is_public=is_public,
            skip_duplicates=skip_duplicates,
        )
        if dry_run:
            db.rollback()
        else:
            db.commit()
    except ImportFormatError as exc:
        db.rollback()
        raise HTTPException(400, str(exc)) from exc
    finally:
        if zip_path is not None:
            zip_path.unlink(missing_ok=True)

    if not dry_run and report.created_book_ids:
        books = db.query(Book).filter(Book.id.in_(report.created_book_ids)).all()
        for b in books:
            background_tasks.add_task(index_book_in_search, _to_out(b).model_dump())

    data = asdict(report)
    data.pop("created_book_ids", None)
    return data
