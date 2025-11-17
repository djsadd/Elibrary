from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserBookNoteBase(BaseModel):
    book_id: int
    page: Optional[int] = None
    note: str


class UserBookNoteCreate(UserBookNoteBase):
    pass  # user_id будет браться из токена


class UserBookNoteUpdate(BaseModel):
    page: Optional[int] = None
    note: Optional[str] = None


class UserBookNoteOut(UserBookNoteBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
