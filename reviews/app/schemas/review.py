from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ReviewBase(BaseModel):
    rating: float = Field(ge=0, le=5, allow_inf_nan=False)
    comment: Optional[str] = Field(None, max_length=10000)


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
        from_attributes = True
