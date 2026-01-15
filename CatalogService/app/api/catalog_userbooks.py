from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.catalog_common import get_db
from app.models.book import UserBook
from app.schemas.userbook import BookMinimal, UserBookCreate, UserBookOut, UserBookUpdate, UserBookWithBookOut
from app.utils.authz import AuthUser, get_current_user

router = APIRouter()


@router.post("/userbook", response_model=UserBookOut)
def create_userbook(
    payload: UserBookCreate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
        reading_time=payload.reading_time,
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


@router.get("/userbook", response_model=list[UserBookWithBookOut])
def list_userbooks_with_books(
    user: AuthUser = Depends(get_current_user),
    book_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(UserBook).filter(UserBook.user_id == user.user_id)
    if book_id:
        query = query.filter(UserBook.book_id == book_id)

    userbooks = query.all()

    result = []
    for ub in userbooks:
        book = ub.book
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
                current_page=ub.current_page,
                total_pages=ub.total_pages,
                progress_percent=ub.progress_percent,
                status=ub.status,
                reading_time=ub.reading_time,
                book=book_data,
            )
        )

    return result


@router.get("/userbook/by-book/{book_id}", response_model=UserBookOut)
def get_userbook_by_book(
    book_id: int,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    userbook = db.query(UserBook).filter(
        UserBook.user_id == user.user_id,
        UserBook.book_id == book_id,
    ).first()

    if not userbook:
        raise HTTPException(404, "UserBook not found")

    return userbook