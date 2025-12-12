import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.favourite import Favourite
from app.schemas.favourite import FavouriteOut, FavouriteCreate
from app.services.external_api import get_book_data
from app.utils.authz import get_current_user
from app.core.config import settings
router = APIRouter(tags=["favourites"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_books_batch(book_ids: list[int]) -> list[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.CATALOG_SERVICE_URL}/books/batch",
            params={"ids": ",".join(map(str, book_ids))}
        )
        return response.json()


@router.get("", response_model=list[FavouriteOut])
async def list_favourites(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    user_id = current_user.user_id
    favourites = db.query(Favourite).filter(Favourite.user_id == user_id).all()
    book_ids = [fav.book_id for fav in favourites]

    books = await get_books_batch(book_ids)

    # безопасное преобразование
    books_dicts = []
    for book in books:
        if isinstance(book, str):
            try:
                import json
                book = json.loads(book)
            except json.JSONDecodeError:
                continue  # пропускаем некорректные данные
        if isinstance(book, dict):
            books_dicts.append(book)

    books_map = {book["id"]: book for book in books_dicts if "id" in book}

    result = []
    for fav in favourites:
        result.append(
            FavouriteOut(**fav.__dict__, book_data=books_map.get(fav.book_id))
        )
    return result



@router.post("", response_model=FavouriteOut, status_code=status.HTTP_201_CREATED)
async def add_favourite(
    fav_data: FavouriteCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    user_id = current_user.user_id

    existing = db.query(Favourite).filter_by(user_id=user_id, book_id=fav_data.book_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already in favourites")

    new_fav = Favourite(user_id=user_id, book_id=fav_data.book_id)
    db.add(new_fav)
    db.commit()
    db.refresh(new_fav)

    book = await get_book_data(fav_data.book_id)
    return FavouriteOut(**new_fav.__dict__, book_data=book)


@router.delete("/{book_id}", status_code=204)
async def remove_favourite(
    book_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    user_id = current_user.user_id
    fav = db.query(Favourite).filter_by(user_id=user_id, book_id=book_id).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Favourite not found")
    db.delete(fav)
    db.commit()
