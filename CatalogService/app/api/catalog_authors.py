from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.catalog_common import _author_to_detail, get_db
from app.models.book import Author
from app.schemas.authors import AuthorDetail, AuthorUpdate

router = APIRouter()


@router.get("/authors", response_model=list[str])
def list_authors(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    query = db.query(Author)
    if q:
        query = query.filter(Author.name.ilike(f"%{q}%"))
    authors = query.order_by(Author.name.asc()).limit(limit).all()
    return [a.name for a in authors]


@router.get("/authors/details", response_model=list[AuthorDetail])
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