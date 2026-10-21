from app.utils.authz import require_roles, get_current_user
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.catalog_common import get_db
from app.models.book import Book
from app.schemas.files import FileWithBooksOut, FilesList
from app.schemas.userbook import BookMinimal
from pathlib import Path
from app.utils.storage import media_root
from app.utils.pagination import clamp_limit, clamp_offset

router = APIRouter()

MEDIA_ROOT = str(media_root())
os.makedirs(MEDIA_ROOT, exist_ok=True)

MAX_RAW_SIZE = 50 * 1024 * 1024


def _public_download_url(file_id: str) -> str:
    return f"/api/catalog/files/{file_id}"


@router.post("/upload/raw", dependencies=[Depends(require_roles("editor", "admin", "librarian"))])
async def upload_raw(
    request: Request,
    x_filename: Optional[str] = Header(default=None, convert_underscores=False),
    content_type: Optional[str] = Header(default=None),
):
    cl = request.headers.get("content-length")
    if cl:
        try:
            if int(cl) < 0:
                raise ValueError()
            if int(cl) > MAX_RAW_SIZE:
                raise HTTPException(413, "File too large")
        except ValueError:
            raise HTTPException(400, "Invalid Content-Length")

    x_filename = x_filename or request.headers.get("x-filename")
    ext = ""
    if x_filename and "." in x_filename:
        base = x_filename.split("/")[-1].split("\\")[-1]
        _, ext = os.path.splitext(base)
    if ext.lower() not in {".pdf", ".epub", ".djvu", ".txt", ".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(415, "Unsupported file extension")
    file_id = f"{uuid.uuid4().hex}{ext.lower()}"

    try:
        await _save_raw_stream(request, file_id)
    except HTTPException:
        raise
    except OSError as exc:
        raise HTTPException(status_code=500, detail="File operation failed") from exc

    return {
        "file": {
            "file_id": file_id,
            "download_url": _public_download_url(file_id),
        }
    }


async def _save_raw_stream(request: Request, file_id: str) -> str:
    path = Path(MEDIA_ROOT) / file_id
    size = 0
    try:
        with path.open("xb") as out:
            async for chunk in request.stream():
                size += len(chunk)
                if size > MAX_RAW_SIZE:
                    raise HTTPException(413, "File too large")
                out.write(chunk)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    return str(path)


@router.get("/files", response_model=FilesList, dependencies=[Depends(require_roles("editor", "admin", "librarian"))])
def list_files_with_books(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    limit = clamp_limit(limit)
    offset = clamp_offset(offset)

    base = db.query(Book).filter(Book.file_id.isnot(None)).filter(Book.file_id != "")
    if q:
        like = f"%{q}%"
        base = base.filter(or_(Book.file_id.ilike(like), Book.title.ilike(like)))

    total = (
        db.query(func.count(func.distinct(Book.file_id)))
        .filter(Book.file_id.isnot(None))
        .filter(Book.file_id != "")
    )
    if q:
        like = f"%{q}%"
        total = total.filter(or_(Book.file_id.ilike(like), Book.title.ilike(like)))
    total_count = total.scalar() or 0

    file_ids = [
        r[0]
        for r in base.with_entities(Book.file_id)
        .distinct()
        .order_by(Book.file_id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    ]

    rows = []
    if file_ids:
        rows = (
            db.query(Book)
            .filter(Book.file_id.in_(file_ids))
            .order_by(Book.file_id.asc(), Book.id.asc())
            .all()
        )

    grouped: dict[str, FileWithBooksOut] = {}
    for b in rows:
        file_id = (b.file_id or "").strip()
        if not file_id:
            continue
        if file_id not in grouped:
            grouped[file_id] = FileWithBooksOut(
                file_id=file_id,
                download_url=b.download_url,
                books=[],
            )
        grouped[file_id].books.append(
            BookMinimal(
                id=b.id,
                title=b.title,
                cover=b.cover,
                authors=[{"id": a.id, "name": a.name} for a in (b.authors or [])],
                formats=b.formats_list,
            )
        )

    return FilesList(
        items=[grouped[fid] for fid in file_ids if fid in grouped],
        page={"limit": limit, "offset": offset, "total": total_count},
    )


_raw_override_mb = os.getenv("CATALOG_MAX_RAW_MB")
if _raw_override_mb:
    try:
        MAX_RAW_SIZE = int(_raw_override_mb) * 1024 * 1024
    except ValueError:
        pass


@router.get("/files/{file_id:path}")
def download_catalog_file(file_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse
    from app.utils.storage import resolve_file
    staff = bool({"admin", "librarian", "editor"}.intersection(r.lower() for r in user.roles))
    query = db.query(Book).filter(Book.file_id == file_id)
    if not staff:
        query = query.filter(Book.is_public.is_(True))
    if not staff and query.first() is None:
        raise HTTPException(404, "File not found")
    path = resolve_file(file_id)
    return FileResponse(path, filename=path.name, content_disposition_type="attachment")
