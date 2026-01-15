from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.catalog_common import get_db
from app.models.book import Author, Book, Playlist, Subject, UserBook, UserBookNote
from app.schemas.userbook import BookMinimal, UserBookWithBookOut
from app.schemas.userbook_note import UserBookNoteOut
from app.utils.authz import require_roles

router = APIRouter()


@router.get(
    "/admin/stats",
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def catalog_admin_stats(db: Session = Depends(get_db)):
    total_books = db.query(func.count(Book.id)).scalar() or 0
    public_books = db.query(func.count(Book.id)).filter(Book.is_public.is_(True)).scalar() or 0
    authors_count = db.query(func.count(Author.id)).scalar() or 0
    subjects_count = db.query(func.count(Subject.id)).scalar() or 0
    playlists_count = db.query(func.count(Playlist.id)).scalar() or 0
    files_count = (
        db.query(func.count(func.distinct(Book.file_id)))
        .filter(Book.file_id.isnot(None))
        .filter(Book.file_id != "")
        .scalar()
        or 0
    )
    userbooks_count = db.query(func.count(UserBook.id)).scalar() or 0
    notes_count = db.query(func.count(UserBookNote.id)).scalar() or 0
    reading_count = db.query(func.count(UserBook.id)).filter(UserBook.status == "reading").scalar() or 0
    completed_count = db.query(func.count(UserBook.id)).filter(UserBook.status == "readed").scalar() or 0
    return {
        "total_books": int(total_books),
        "public_books": int(public_books),
        "authors": int(authors_count),
        "subjects": int(subjects_count),
        "playlists": int(playlists_count),
        "files": int(files_count),
        "userbooks": int(userbooks_count),
        "notes": int(notes_count),
        "reading": int(reading_count),
        "completed": int(completed_count),
    }


@router.get(
    "/admin/users/{user_id}/userbooks",
    response_model=list[UserBookWithBookOut],
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def list_userbooks_for_admin(
    user_id: int,
    db: Session = Depends(get_db),
):
    userbooks = db.query(UserBook).filter(UserBook.user_id == user_id).all()
    result = []
    for ub in userbooks:
        book = ub.book
        if not book:
            continue
        book_data = BookMinimal(
            id=book.id,
            title=book.title,
            cover=book.cover,
            authors=[{"id": a.id, "name": a.name} for a in book.authors],
            formats=book.formats_list,
        )
        result.append(
            UserBookWithBookOut(
                id=ub.id,
                current_page=ub.current_page or 0,
                total_pages=ub.total_pages,
                progress_percent=ub.progress_percent or 0,
                status=ub.status or "reading",
                reading_time=ub.reading_time,
                book=book_data,
            )
        )
    return result


@router.get(
    "/admin/users/{user_id}/notes",
    response_model=list[UserBookNoteOut],
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def list_userbook_notes_for_admin(
    user_id: int,
    db: Session = Depends(get_db),
    book_id: Optional[int] = None,
):
    query = db.query(UserBookNote).filter(UserBookNote.user_id == user_id)
    if book_id:
        query = query.filter(UserBookNote.book_id == book_id)
    return query.order_by(UserBookNote.created_at.desc()).all()


@router.get(
    "/admin/users/{user_id}/stats",
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def user_stats_for_admin(
    user_id: int,
    db: Session = Depends(get_db),
):
    base = db.query(UserBook).filter(UserBook.user_id == user_id)
    total = base.count()
    reading = base.filter(UserBook.status == "reading").count()
    completed = base.filter(UserBook.status == "readed").count()
    dropped = base.filter(UserBook.status == "dropped").count()
    total_time = (
        db.query(func.coalesce(func.sum(UserBook.reading_time), 0.0))
        .filter(UserBook.user_id == user_id)
        .scalar()
    )
    avg_progress = (
        db.query(func.avg(UserBook.progress_percent))
        .filter(UserBook.user_id == user_id)
        .scalar()
    )
    last_opened = (
        db.query(func.max(UserBook.last_opened_at))
        .filter(UserBook.user_id == user_id)
        .scalar()
    )
    first_started = (
        db.query(func.min(UserBook.started_at))
        .filter(UserBook.user_id == user_id)
        .scalar()
    )
    notes_count = (
        db.query(func.count(UserBookNote.id))
        .filter(UserBookNote.user_id == user_id)
        .scalar()
    )
    return {
        "total_books": total,
        "reading": reading,
        "completed": completed,
        "dropped": dropped,
        "avg_progress": float(avg_progress or 0.0),
        "total_reading_time": float(total_time or 0.0),
        "notes_count": int(notes_count or 0),
        "first_started_at": first_started,
        "last_opened_at": last_opened,
    }