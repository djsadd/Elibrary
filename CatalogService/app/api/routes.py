from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.db import SessionLocal
from app.models import Book, Author, Subject
from app.schemas.book import BookCreate, BookUpdate, BookOut, BookList
from app.utils.pagination import clamp_limit, clamp_offset

from app.utils.authz import require_roles, AuthUser

router = APIRouter(prefix="/catalog", tags=["catalog"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
        authors=[a.name for a in b.authors],
        subjects=[s.name for s in b.subjects],
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

    total = query.count()
    rows = query.offset(offset).limit(limit).all()

    return BookList(
        items=[_to_out(b) for b in rows],
        page={"limit": limit, "offset": offset, "total": total},
    )


# ---- public get ----
@router.get("/books/{book_id}", response_model=BookOut)
def get_book(book_id: int, db: Session = Depends(get_db)):
    b = db.get(Book, book_id)
    if not b:
        raise HTTPException(404, "Book not found")
    return _to_out(b)


# ---- SECURED (admin/librarian) ----
_admin_guard = Depends(require_roles("admin", "librarian"))


@router.post("/books", response_model=BookOut, status_code=201, dependencies=[_admin_guard])
def create_book(payload: BookCreate, db: Session = Depends(get_db)):
    b = Book(
        title=payload.title,
        year=payload.year,
        lang=payload.lang,
        pub_info=payload.pub_info,
        summary=payload.summary,
        cover=payload.cover,
        file_id=payload.file_id,
        download_url=payload.download_url,
    )
    b.authors = _ensure_authors(db, payload.authors or [])
    b.subjects = _ensure_subjects(db, payload.subjects or [])
    db.add(b)
    db.commit()
    db.refresh(b)
    return _to_out(b)


# ---- admin update ----
@router.put("/books/{book_id}", response_model=BookOut, dependencies=[_admin_guard])
def update_book(book_id: int, payload: BookUpdate, db: Session = Depends(get_db)):
    b = db.get(Book, book_id)
    if not b:
        raise HTTPException(404, "Book not found")

    for field in ("title", "year", "lang", "pub_info", "summary", "cover", "file_id", "download_url"):
        val = getattr(payload, field)
        if val is not None:
            setattr(b, field, val)

    if payload.authors is not None:
        b.authors = _ensure_authors(db, payload.authors)
    if payload.subjects is not None:
        b.subjects = _ensure_subjects(db, payload.subjects)

    db.add(b)
    db.commit()
    db.refresh(b)
    return _to_out(b)


# ---- admin delete ----

@router.delete("/books/{book_id}", status_code=204, dependencies=[_admin_guard])
def delete_book(book_id: int, db: Session = Depends(get_db)):
    b = db.get(Book, book_id)
    if not b:
        raise HTTPException(404, "Book not found")
    db.delete(b)
    db.commit()
    return None
