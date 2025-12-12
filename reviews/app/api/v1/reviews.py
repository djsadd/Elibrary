from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import logging

from app.core.db import get_db
from app.models.review import Review
from app.schemas.review import ReviewCreate, ReviewOut, ReviewUpdate
from app.utils.authz import get_current_user, AuthUser, require_roles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reviews", tags=["Reviews"])


# -------------------------------
# CRUD
# -------------------------------
@router.get("/book/{book_id}", response_model=List[ReviewOut])
def get_reviews_for_book(book_id: int, db: Session = Depends(get_db)):
    return db.query(Review).filter(Review.book_id == book_id).all()


@router.get("", response_model=List[ReviewOut])
def get_reviews(book_id: int = None, db: Session = Depends(get_db)):
    query = db.query(Review)
    if book_id is not None:
        query = query.filter(Review.book_id == book_id)
    return query.all()


@router.post("", response_model=ReviewOut)
def create_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),  # <-- явно указываем тип
):
    # Проверяем, есть ли уже отзыв от этого пользователя для этой книги
    existing = (
        db.query(Review)
        .filter(Review.book_id == payload.book_id, Review.user_id == user.user_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already reviewed this book")

    # Создаем новый отзыв
    review = Review(
        book_id=payload.book_id,
        user_id=user.user_id,
        rating=payload.rating,
        comment=payload.comment,
    )

    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.patch("/{review_id}", response_model=ReviewOut)
def update_review(
    review_id: int,
    payload: ReviewUpdate,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if "admin" not in [r.lower() for r in user.roles] and review.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    for k, v in payload.dict(exclude_unset=True).items():
        setattr(review, k, v)
    db.commit()
    db.refresh(review)
    return review


@router.delete("/{review_id}")
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if "admin" not in [r.lower() for r in user.roles] and review.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    db.delete(review)
    db.commit()
    return {"detail": "Review deleted"}
