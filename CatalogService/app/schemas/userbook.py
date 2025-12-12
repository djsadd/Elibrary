from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class UserBookBase(BaseModel):
    book_id: int
    current_page: Optional[int] = 0
    total_pages: Optional[int] = None
    progress_percent: Optional[float] = 0.0
    status: Optional[str] = "reading"
    reading_time: Optional[float] = 0.0


class UserBookCreate(UserBookBase):
    pass


class UserBookUpdate(BaseModel):
    current_page: Optional[int] = None
    total_pages: Optional[int] = None
    progress_percent: Optional[float] = None
    status: Optional[str] = None
    reading_time: Optional[float] = None


class UserBookOut(UserBookBase):
    id: int
    user_id: int
    started_at: datetime
    last_opened_at: datetime

    class Config:
        orm_mode = True


class BookMinimal(BaseModel):
    id: int
    title: str
    cover: Optional[str]
    authors: List[dict] = []
    formats: List[str]  # <-- добавляем


class UserBookWithBookOut(BaseModel):
    id: int
    current_page: int
    total_pages: Optional[int]
    progress_percent: float
    status: str
    reading_time: Optional[float]
    book: BookMinimal
