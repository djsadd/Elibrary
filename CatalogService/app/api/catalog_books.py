import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.catalog_common import _ensure_authors, _ensure_subjects, _to_out, get_db
from app.models.book import Author, Book, Subject, UserBook
from app.schemas.book import BookCreate, BookList, BookOut, BookUpdate
from app.utils.authz import require_roles
from app.utils.pagination import clamp_limit, clamp_offset

router = APIRouter()


@router.get("/books/batch", response_model=list[BookOut])
def get_books_batch(
    ids: str = Query(..., description="Comma-separated book IDs, e.g. 1,2,3"),
    db: Session = Depends(get_db),
):
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


@router.get(
    "/books/{book_id}/download",
    response_class=FileResponse,
    dependencies=[Depends(require_roles("librarian", "admin"))],
)
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
        media_type="application/pdf",
    )


@router.get(
    "/books/{book_id}/stream",
    dependencies=[Depends(require_roles("librarian", "admin"))],
)
def stream_book(book_id: int, db: Session = Depends(get_db)):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    file_path = os.path.join("storage", book.file_id)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={book.title}.pdf"},
    )


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


@router.get("/books/search", response_model=BookList)
def search_books(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
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


@router.get("/books/{book_id}", response_model=BookOut)
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(404, "Book not found")
    return _to_out(book)


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
