from pydantic import BaseModel
from datetime import datetime

class FavouriteBase(BaseModel):
    book_id: int

class FavouriteCreate(FavouriteBase):
    pass

class FavouriteOut(FavouriteBase):
    id: int
    user_id: int
    created_at: datetime
    book_data: dict | None = None

    class Config:
        from_attributes = True
