from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.catalog_common import (
    _apply_i18n,
    _delete_named,
    _stats_named,
    _author_to_detail,
    _merge_named,
    _name_search,
    _page_named,
    _reindex_books,
    get_db,
)
from app.models.book import Author, book_authors
from app.schemas.authors import AuthorCreate, AuthorDetail, AuthorMerge, AuthorPage, AuthorUpdate
from app.utils.authz import require_roles
from app.schemas.common import TaxonomyStats
from app.utils.i18n_names import fill_detected_lang

router = APIRouter()

STAFF = Depends(require_roles("editor", "admin", "librarian"))


@router.get("/authors", response_model=list[str])
def list_authors(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    authors = _name_search(db.query(Author), Author, q).order_by(Author.name.asc()).limit(limit).all()
    return [a.name for a in authors]


@router.get("/authors/details", response_model=list[AuthorDetail])
def list_authors_details(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    authors = _name_search(db.query(Author), Author, q).order_by(Author.name.asc()).limit(limit).all()
    return [_author_to_detail(a) for a in authors]


@router.get("/authors/page", response_model=AuthorPage)
def page_authors(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Pagination for the admin list: items with books_count + page {limit, offset, total}."""
    return _page_named(db, Author, book_authors, "author_id", q, limit, offset)


@router.post("/authors", response_model=AuthorDetail, status_code=status.HTTP_201_CREATED, dependencies=[STAFF])
def create_author(payload: AuthorCreate, db: Session = Depends(get_db)):
    author = Author(name=payload.name.strip())
    _apply_i18n(author, payload)
    fill_detected_lang(author)
    db.add(author)
    try:
        db.commit()
        db.refresh(author)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Author '{payload.name}' already exists.")
    return _author_to_detail(author)


@router.post("/authors/merge", response_model=AuthorDetail, dependencies=[STAFF])
def merge_authors(payload: AuthorMerge, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Объединить дубли авторов в одного и сразу присвоить новое название."""
    target, book_ids = _merge_named(db, Author, "authors", payload, "Author")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Author '{payload.name}' already exists.")
    db.refresh(target)
    _reindex_books(db, book_ids, background_tasks)
    return _author_to_detail(target)


@router.get("/authors/{author_id}", response_model=AuthorDetail)
def get_author(author_id: int, db: Session = Depends(get_db)):
    author = db.get(Author, author_id)
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    return _author_to_detail(author)


@router.get("/authors/{author_id}/stats", response_model=TaxonomyStats, dependencies=[STAFF])
def author_stats(author_id: int, db: Session = Depends(get_db)):
    """Аналитика: книги, читатели, языки, форматы, связанные категории."""
    obj = db.get(Author, author_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Author not found")
    return _stats_named(db, obj, "subjects")


@router.delete("/authors/{author_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[STAFF])
def delete_author(author_id: int, db: Session = Depends(get_db)):
    """Удалить можно только если к записи не привязано ни одной книги (иначе 409)."""
    _delete_named(db, Author, book_authors, "author_id", author_id, "Author")


@router.patch("/authors/{author_id}", response_model=AuthorDetail, dependencies=[STAFF])
def update_author(
    author_id: int,
    payload: AuthorUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    author = db.get(Author, author_id)
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    if payload.name is not None:
        new_name = payload.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Author name is required")
        author.name = new_name
    _apply_i18n(author, payload)

    try:
        db.commit()
        db.refresh(author)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Author '{payload.name}' already exists.")

    _reindex_books(db, [b.id for b in author.books or []], background_tasks)
    return _author_to_detail(author)
