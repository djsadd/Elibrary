from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.schemas.book import BookOut  # 🔥 Импортируем готовую схему книги


class PlaylistBase(BaseModel):
    title: str
    description: Optional[str] = None


class PlaylistCreate(PlaylistBase):
    book_ids: Optional[List[int]] = []


class PlaylistUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    book_ids: Optional[List[int]] = []


class PlaylistOut(PlaylistBase):
    id: int
    created_at: datetime
    updated_at: datetime
    books: List[BookOut] = []  # ✅ вместо List[dict]

    class Config:
        from_attributes = True
