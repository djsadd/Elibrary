from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ReviewBase(BaseModel):
    rating: float = Field(ge=0, le=5)
    comment: Optional[str] = None


class ReviewCreate(ReviewBase):
    book_id: int


class ReviewUpdate(ReviewBase):
    pass


class ReviewOut(ReviewBase):
    id: int
    book_id: int
    user_id: int
    created_at: datetime

    class Config:
        orm_mode = True
