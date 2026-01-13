from sqlalchemy.exc import IntegrityError
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header
from sqlalchemy.orm import Session
from typing import List, Optional
import requests
from sqlalchemy import select, func, or_
from fastapi.responses import StreamingResponse

from app.utils.authz import get_current_user, AuthUser
from fastapi import File, UploadFile, Form
from app.core.db import SessionLocal
from app.models.book import Book, Author, Subject, Playlist, UserBook, UserBookNote
from app.schemas.book import BookCreate, BookUpdate, BookOut, BookList, AuthorOut, SubjectOut
from app.schemas.files import FileWithBooksOut, FilesList
from app.utils.pagination import clamp_limit, clamp_offset
from app.core.config import settings
from app.utils.authz import require_roles, AuthUser
import os, uuid, shutil
from fastapi.responses import FileResponse
import base64
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.schemas.playlist import PlaylistCreate, PlaylistUpdate, PlaylistOut
from app.schemas.userbook import UserBookOut, UserBookCreate, UserBookUpdate, BookMinimal, UserBookWithBookOut
from app.schemas.userbook_note import UserBookNoteOut, UserBookNoteCreate, UserBookNoteUpdate
from app.schemas.authors import AuthorCreate, AuthorUpdate, AuthorDetail
from app.schemas.subjects import SubjectCreate, SubjectUpdate, SubjectDetail

router = APIRouter(prefix="/catalog", tags=["catalog"])

MEDIA_ROOT = os.path.abspath(os.getenv("MEDIA_ROOT", "./storage"))
os.makedirs(MEDIA_ROOT, exist_ok=True)
UPLOAD_DIR = "static/covers"  # путь, куда сохраняем картинки

MAX_RAW_SIZE = 50 * 1024 * 1024  # 50MB общий лимит на raw-загрузку



def _public_download_url(file_id: str) -> str:
    # меняй, если раздаёшь статику по другому префиксу
    return f"/files/{file_id}"


@router.post("/upload/raw")
async def upload_raw(
    request: Request,
    x_filename: Optional[str] = Header(default=None, convert_underscores=False),
    content_type: Optional[str] = Header(default=None),
):
    cl = request.headers.get("content-length")
    if cl and int(cl) > MAX_RAW_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    ext = ""
    if x_filename and "." in x_filename:
        base = x_filename.split("/")[-1].split("\\")[-1]
        _, ext = os.path.splitext(base)
    file_id = f"{uuid.uuid4().hex}{ext or '.bin'}"

    try:
        abs_path = await _save_raw_stream(request, file_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Save failed: {e}")

    return {
        "file": {
            "file_id": file_id,
            "download_url": _public_download_url(file_id),
        }
    }


async def _save_raw_stream(request: Request, file_id: str) -> str:
    abs_path = os.path.join(MEDIA_ROOT, file_id)
    with open(abs_path, "wb") as out:
        async for chunk in request.stream():
            if not chunk:
                continue
            out.write(chunk)
    return abs_path


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/filters")
def get_filters(db: Session = Depends(get_db)):
    # Авторы
    authors = [a.name for a in db.query(Author).order_by(Author.name).all()]

    # Жанры / предметы
    subjects = [s.name for s in db.query(Subject).order_by(Subject.name).all()]

    # Языки (у тебя фиксированные)
    langs = ["Russian", "English", "Kazakh"]

    # Года (все года книг)
    years = [y for (y,) in db.query(Book.year).distinct().order_by(Book.year.desc()).all() if y]

    return {
        "authors": authors,
        "subjects": subjects,
        "langs": langs,
        "years": years,
    }


# ---- helpers ----
def _ensure_authors(db: Session, names: list[str]) -> list[Author]:
    out: list[Author] = []
    for n in names:
        n = n.strip()
        if not n:
            continue
        obj = db.query(Author).filter(Author.name == n).first()
        if not obj:
            obj = Author(name=n)
            db.add(obj)
            db.flush()
        out.append(obj)
    return out


def _ensure_subjects(db: Session, names: list[str]) -> list[Subject]:
    out: list[Subject] = []
    for n in names:
        n = n.strip()
        if not n:
            continue
        obj = db.query(Subject).filter(Subject.name == n).first()
        if not obj:
            obj = Subject(name=n)
            db.add(obj)
            db.flush()
        out.append(obj)
    return out


@router.get("/books/batch", response_model=List[BookOut])
def get_books_batch(
    ids: str = Query(..., description="Comma-separated book IDs, e.g. 1,2,3"),
    db: Session = Depends(get_db),
):
    """
    Возвращает список книг по списку ID.
    Пример запроса:
        GET /catalog/books/batch?ids=1,2,3
    """
    try:
        id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()]
        if not id_list:
            raise HTTPException(400, "No valid IDs provided")
    except Exception:
        raise HTTPException(400, "Invalid ID list")

    books = db.query(Book).filter(Book.id.in_(id_list)).all()
    if not books:
        raise HTTPException(404, "No books found for provided IDs")

    return [_to_out(b) for b in books]


# ---- public download ----
@router.get("/books/{book_id}/download", response_class=FileResponse)
def download_book(book_id: int, db: Session = Depends(get_db)):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    file_path = os.path.join("storage", book.file_id)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        filename=f"{book.title}.pdf",
        media_type="application/pdf"
    )


@router.get("/books/{book_id}/stream")
def stream_book(book_id: int, db: Session = Depends(get_db)):
    """
    Стриминг PDF файла по частям (не скачивание)
    """
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    file_path = os.path.join("storage", book.file_id)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    def iterfile():
        with open(file_path, mode="rb") as f:
            while chunk := f.read(1024 * 1024):   # 1MB чанки
                yield chunk

    return StreamingResponse(
        iterfile(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={book.title}.pdf"
        }
    )


def _to_out(b: Book) -> BookOut:
    return BookOut(
        id=b.id,
        title=b.title,
        year=b.year,
        lang=b.lang,
        pub_info=b.pub_info,
        summary=b.summary,
        cover=b.cover,
        file_id=b.file_id,
        download_url=b.download_url,
        formats=b.formats_list,
        authors=[AuthorOut.from_orm(a) for a in b.authors],
        subjects=[SubjectOut.from_orm(s) for s in b.subjects],
    )


# ---- files with books ----
@router.get("/files", response_model=FilesList)
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

# ---- public list ----
@router.get("/books", response_model=BookList)
def list_books(
        db: Session = Depends(get_db),
        q: Optional[str] = None,
        author: Optional[str] = None,
        subject: Optional[str] = None,
        lang: Optional[str] = None,
        year: Optional[str] = None,
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0),
):

    limit = clamp_limit(limit)
    offset = clamp_offset(offset)

    query = db.query(Book)
    if q:
        like = f"%{q}%"
        query = query.filter(Book.title.ilike(like))

    if lang:
        query = query.filter(Book.lang == lang)
    if year:
        query = query.filter(Book.year == year)
    if author:
        query = query.join(Book.authors).filter(Author.name.ilike(f"%{author}%"))
    if subject:
        query = query.join(Book.subjects).filter(Subject.name.ilike(f"%{subject}%"))

    popularity_subq = (
        db.query(UserBook.book_id, func.count(UserBook.id).label("popularity"))
        .group_by(UserBook.book_id)
        .subquery()
    )
    popularity_order = func.coalesce(popularity_subq.c.popularity, 0).desc()
    query = query.outerjoin(popularity_subq, Book.id == popularity_subq.c.book_id)

    total = query.order_by(None).count()
    rows = query.order_by(popularity_order, Book.title.asc()).offset(offset).limit(limit).all()

    return BookList(
        items=[_to_out(b) for b in rows],
        page={"limit": limit, "offset": offset, "total": total},
    )


# ---- public search ----
@router.get("/books/search", response_model=BookList)
def search_books(
    db: Session = Depends(get_db),
    q: Optional[str] = None,  # Search query
    lang: Optional[str] = None,
    year: Optional[str] = None,
    limit: Optional[int] = Query(None, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    if limit is not None:
        limit = clamp_limit(limit)
    offset = clamp_offset(offset)

    query = db.query(Book)

    if q:
        like = f"%{q}%"
        # Search across title OR author OR subject
        query = (
            query.outerjoin(Book.authors)
            .outerjoin(Book.subjects)
            .filter(or_(Book.title.ilike(like), Author.name.ilike(like), Subject.name.ilike(like)))
            .distinct()
        )

    if lang:
        query = query.filter(Book.lang == lang)
    if year:
        query = query.filter(Book.year == year)

    popularity_subq = (
        db.query(UserBook.book_id, func.count(UserBook.id).label("popularity"))
        .group_by(UserBook.book_id)
        .subquery()
    )
    popularity_order = func.coalesce(popularity_subq.c.popularity, 0).desc()
    query = query.outerjoin(popularity_subq, Book.id == popularity_subq.c.book_id)

    total = query.order_by(None).count()
    if limit is None:
        rows = query.order_by(popularity_order, Book.title.asc()).offset(offset).all()
        page_limit = len(rows)
    else:
        rows = query.order_by(popularity_order, Book.title.asc()).offset(offset).limit(limit).all()
        page_limit = limit

    return BookList(
        items=[_to_out(b) for b in rows],
        page={"limit": page_limit, "offset": offset, "total": total},
    )


# ---- public get ----
@router.get("/books/{book_id}", response_model=BookOut)
def get_book(book_id: int, db: Session = Depends(get_db)):
    b = db.get(Book, book_id)
    if not b:
        raise HTTPException(404, "Book not found")
    return _to_out(b)


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


@router.post("/books", response_model=BookOut, status_code=status.HTTP_201_CREATED)
def create_book(payload: BookCreate, db: Session = Depends(get_db)):
    book = Book(
        title=payload.title,
        year=payload.year,
        lang=payload.lang,
        pub_info=payload.pub_info,
        summary=payload.summary,
        cover=payload.cover,
        file_id=payload.file_id,
        download_url=payload.download_url,
        source=payload.source,
        isbn=payload.isbn,
        edition=payload.edition,
        page_count=payload.page_count,
        available_copies=payload.available_copies,
        is_public=payload.is_public,
    )
    book.formats_list = payload.formats or []
    book.authors = _ensure_authors(db, payload.authors or [])
    book.subjects = _ensure_subjects(db, payload.subjects or [])

    db.add(book)
    try:
        db.commit()
        db.refresh(book)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Book already exists")
    return _to_out(book)


@router.patch("/books/{book_id}", response_model=BookOut)
def update_book(
    book_id: int,
    payload: BookUpdate,
    db: Session = Depends(get_db),
):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    authors = data.pop("authors", None)
    subjects = data.pop("subjects", None)
    formats = data.pop("formats", None)
    source = data.pop("source", None)

    for key, value in data.items():
        setattr(book, key, value)

    if source is not None:
        book.source = source
    if formats is not None:
        book.formats_list = [str(f).strip().upper() for f in formats if str(f).strip()]
    if authors is not None:
        book.authors = _ensure_authors(db, authors)
    if subjects is not None:
        book.subjects = _ensure_subjects(db, subjects)

    try:
        db.commit()
        db.refresh(book)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to update book")

    return _to_out(book)

@router.get("/authors", response_model=List[str])
def list_authors(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200)
):
    query = db.query(Author)
    if q:
        query = query.filter(Author.name.ilike(f"%{q}%"))
    authors = query.order_by(Author.name.asc()).limit(limit).all()
    return [a.name for a in authors]


def _author_to_detail(author: Author) -> AuthorDetail:
    books = [
        BookMinimal(
            id=b.id,
            title=b.title,
            cover=b.cover,
            authors=[{"id": a.id, "name": a.name} for a in b.authors],
            formats=b.formats_list,
        )
        for b in (author.books or [])
    ]
    return AuthorDetail(id=author.id, name=author.name, books=books)


@router.get("/authors/details", response_model=List[AuthorDetail])
def list_authors_details(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    query = db.query(Author)
    if q:
        query = query.filter(Author.name.ilike(f"%{q}%"))
    authors = query.order_by(Author.name.asc()).limit(limit).all()
    return [_author_to_detail(a) for a in authors]


@router.get("/authors/{author_id}", response_model=AuthorDetail)
def get_author(author_id: int, db: Session = Depends(get_db)):
    author = db.get(Author, author_id)
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    return _author_to_detail(author)


@router.patch("/authors/{author_id}", response_model=AuthorDetail)
def update_author(
    author_id: int,
    payload: AuthorUpdate,
    db: Session = Depends(get_db),
):
    author = db.get(Author, author_id)
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    new_name = payload.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Author name is required")

    author.name = new_name
    try:
        db.commit()
        db.refresh(author)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Author '{payload.name}' already exists.",
        )

    return _author_to_detail(author)


@router.post("/subjects", response_model=str, status_code=status.HTTP_201_CREATED)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)):
    """
    Создание новой категории.
    Если категория с таким названием уже существует — возвращает 400.
    """
    subject = Subject(name=payload.name.strip())

    db.add(subject)
    try:
        db.commit()
        db.refresh(subject)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Жанр сназванием '{payload.name}' уже существует.",
        )

    return subject.name


def _subject_to_detail(subject: Subject) -> SubjectDetail:
    books = [
        BookMinimal(
            id=b.id,
            title=b.title,
            cover=b.cover,
            authors=[{"id": a.id, "name": a.name} for a in b.authors],
            formats=b.formats_list,
        )
        for b in (subject.books or [])
    ]
    return SubjectDetail(id=subject.id, name=subject.name, books=books)


@router.patch("/subjects/{subject_id}", response_model=SubjectDetail)
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    new_name = payload.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Subject name is required")

    subject.name = new_name
    try:
        db.commit()
        db.refresh(subject)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Subject '{payload.name}' already exists.",
        )

    return _subject_to_detail(subject)


@router.get("/subjects", response_model=List[str])
def list_subjects(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200)
):
    query = db.query(Subject)
    if q:
        query = query.filter(Subject.name.ilike(f"%{q}%"))
    subjects = query.order_by(Subject.name.asc()).limit(limit).all()
    return [s.name for s in subjects]


@router.get("/subjects/details", response_model=List[SubjectOut])
def list_subjects_details(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    query = db.query(Subject)
    if q:
        query = query.filter(Subject.name.ilike(f"%{q}%"))
    subjects = query.order_by(Subject.name.asc()).limit(limit).all()
    return subjects


@router.get("/subjects/{subject_id}", response_model=SubjectDetail)
def get_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return _subject_to_detail(subject)


@router.get("/langs", response_model=List[str])
def list_langs():
    return ["Russian", "English", "Kazakh"]


# Dependency для получения сессии
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- CRUD --- Playlists

@router.post("/playlists", response_model=PlaylistOut, status_code=status.HTTP_201_CREATED)
def create_playlist(payload: PlaylistCreate, db: Session = Depends(get_db)):
    playlist = Playlist(title=payload.title, description=payload.description)

    if payload.book_ids:
        books = db.query(Book).filter(Book.id.in_(payload.book_ids)).all()
        playlist.books = books

    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return playlist


@router.get("/playlists", response_model=List[PlaylistOut])
def list_playlists(db: Session = Depends(get_db)):
    playlists = db.query(Playlist).order_by(Playlist.created_at.desc()).all()
    return playlists


@router.get("/playlists/{playlist_id}", response_model=PlaylistOut)
def get_playlist(playlist_id: int, db: Session = Depends(get_db)):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


@router.put("/playlists/{playlist_id}", response_model=PlaylistOut)
def update_playlist(playlist_id: int, payload: PlaylistUpdate, db: Session = Depends(get_db)):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if payload.title is not None:
        playlist.title = payload.title
    if payload.description is not None:
        playlist.description = payload.description
    if payload.book_ids is not None:
        books = db.query(Book).filter(Book.id.in_(payload.book_ids)).all()
        playlist.books = books

    db.commit()
    db.refresh(playlist)
    return playlist


@router.delete("/playlists/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playlist(playlist_id: int, db: Session = Depends(get_db)):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    db.delete(playlist)
    db.commit()
    return


# ---------- CRUD ---------- UserBook
@router.post("/userbook", response_model=UserBookOut)
def create_userbook(
    payload: UserBookCreate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Создание прогресса чтения для текущего пользователя.
    """
    existing = db.query(UserBook).filter_by(user_id=user.user_id, book_id=payload.book_id).first()
    if existing:
        raise HTTPException(400, "UserBook already exists")

    userbook = UserBook(
        user_id=user.user_id,
        book_id=payload.book_id,
        current_page=payload.current_page,
        total_pages=payload.total_pages,
        progress_percent=payload.progress_percent,
        status=payload.status,
        reading_time=payload.reading_time
    )
    db.add(userbook)
    db.commit()
    db.refresh(userbook)
    return userbook


@router.patch("/userbook/{userbook_id}", response_model=UserBookOut)
def update_userbook(
    userbook_id: int,
    payload: UserBookUpdate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Обновление прогресса чтения текущего пользователя.
    """
    userbook = db.get(UserBook, userbook_id)
    if not userbook or userbook.user_id != user.user_id:
        raise HTTPException(404, "UserBook not found")

    for key, value in payload.dict(exclude_unset=True).items():
        setattr(userbook, key, value)

    db.commit()
    db.refresh(userbook)
    return userbook


@router.get("/userbook/reading_count/{book_id}")
async def book_reading_count(
        book_id: int,
        user: AuthUser = Depends(get_current_user),
        db: Session = Depends(get_db),
):
    reading_count = db.scalar(
        select(func.count())
        .select_from(UserBook)
        .where(UserBook.status == "reading", UserBook.book_id == book_id)
    )

    readed_count = db.scalar(
        select(func.count())
        .select_from(UserBook)
        .where(UserBook.status == "readed", UserBook.book_id == book_id)
    )

    currently_reading = reading_count or 0
    have_read = readed_count or 0
    return {"currently_reading": currently_reading, "have_read": have_read}


@router.get("/userbook", response_model=List[UserBookWithBookOut])
def list_userbooks_with_books(
    user: AuthUser = Depends(get_current_user),
    book_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Получение всех прогрессов чтения текущего пользователя.
    Вместе с минимальной информацией о книге.
    Можно фильтровать по book_id.
    """
    query = db.query(UserBook).filter(UserBook.user_id == user.user_id)
    if book_id:
        query = query.filter(UserBook.book_id == book_id)

    userbooks = query.all()

    result = []
    for ub in userbooks:
        book = ub.book  # SQLAlchemy relationship
        book_data = BookMinimal(
            id=book.id,
            title=book.title,
            cover=book.cover,
            authors=[{"id": a.id, "name": a.name} for a in book.authors],
            formats=book.formats_list
        )
        result.append(
            UserBookWithBookOut(
                id=ub.id,
                current_page=ub.current_page,
                total_pages=ub.total_pages,
                progress_percent=ub.progress_percent,
                status=ub.status,
                reading_time=ub.reading_time,
                book=book_data
            )
        )

    return result


@router.get(
    "/admin/users/{user_id}/userbooks",
    response_model=List[UserBookWithBookOut],
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def list_userbooks_for_admin(
    user_id: int,
    db: Session = Depends(get_db),
):
    userbooks = (
        db.query(UserBook)
        .filter(UserBook.user_id == user_id)
        .all()
    )
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
            formats=book.formats_list
        )
        result.append(
            UserBookWithBookOut(
                id=ub.id,
                current_page=ub.current_page or 0,
                total_pages=ub.total_pages,
                progress_percent=ub.progress_percent or 0,
                status=ub.status or "reading",
                reading_time=ub.reading_time,
                book=book_data
            )
        )
    return result


@router.get(
    "/admin/users/{user_id}/notes",
    response_model=List[UserBookNoteOut],
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


@router.get("/userbook/by-book/{book_id}", response_model=UserBookOut)
def get_userbook_by_book(
    book_id: int,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Получение прогресса чтения текущего пользователя по ID книги.
    """
    userbook = db.query(UserBook).filter(
        UserBook.user_id == user.user_id,
        UserBook.book_id == book_id
    ).first()

    if not userbook:
        raise HTTPException(404, "UserBook not found")

    return userbook


@router.post("/notes", response_model=UserBookNoteOut)
def create_userbook_note(
    payload: UserBookNoteCreate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Создание заметки пользователя по книге и странице.
    """
    note = UserBookNote(
        user_id=user.user_id,
        book_id=payload.book_id,
        page=payload.page,
        note=payload.note
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/notes/{note_id}", response_model=UserBookNoteOut)
def update_userbook_note(
    note_id: int,
    payload: UserBookNoteUpdate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Обновление заметки пользователя.
    """
    note = db.get(UserBookNote, note_id)
    if not note or note.user_id != user.user_id:
        raise HTTPException(404, "Note not found")

    for key, value in payload.dict(exclude_unset=True).items():
        setattr(note, key, value)

    db.commit()
    db.refresh(note)
    return note


@router.get("/notes", response_model=List[UserBookNoteOut])
def list_userbook_notes(
    user: AuthUser = Depends(get_current_user),
    book_id: Optional[int] = None,
    page: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Получение всех заметок текущего пользователя.
    Можно фильтровать по книге и странице.
    """
    query = db.query(UserBookNote).filter(UserBookNote.user_id == user.user_id)
    if book_id:
        query = query.filter(UserBookNote.book_id == book_id)
    if page:
        query = query.filter(UserBookNote.page == page)
    return query.all()


# AI-SERVICE

AI_API_BASE = "http://192.168.112.182"


import httpx


async def login_to_auth_service():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{AI_API_BASE}/auth/login",
            data={
                "username": "erasil.bakhytgan@gmail.com",
                "password": "Polipol1313"
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Auth service login failed")
        return response.json()  # ожидаем {"access_token": "..."}


@router.post("/chat_card")
async def chat_card(data: dict):
    # 1. Логинимся и получаем токен
    auth_data = await login_to_auth_service()
    token = auth_data.get("access_token")
    if not token:
        raise HTTPException(status_code=500, detail="No token received from auth service")

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{AI_API_BASE}/api/chat_card",
            json=data,
            headers={"Authorization": f"Bearer {token}"}
        )
        return r.json()

@router.post("/generate_llm_context")
async def generate_llm_context(data: dict):
    try:
        # 1. Логинимся
        auth_data = await login_to_auth_service()
        token = auth_data.get("access_token")
        if not token:
            raise HTTPException(status_code=500, detail="No token received from auth service")

        # 2. Запрос к AI сервису
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{AI_API_BASE}/api/generate_llm_context",
                json=data,
                headers={"Authorization": f"Bearer {token}"}
            )
            # Проверяем, JSON ли вернул сервис
            try:
                return r.json()
            except Exception:
                # Если нет, возвращаем текст
                return {"text": r.text}

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Optional override of raw upload limit via env (megabytes).
_raw_override_mb = os.getenv("CATALOG_MAX_RAW_MB")
if _raw_override_mb:
    try:
        MAX_RAW_SIZE = int(_raw_override_mb) * 1024 * 1024
    except ValueError:
        # ignore invalid override, keep default
        pass

