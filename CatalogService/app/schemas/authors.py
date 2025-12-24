from pydantic import BaseModel, Field
from typing import List
from app.schemas.userbook import BookMinimal


class AuthorCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256, description="Имя автора")


class AuthorUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256, description="Author name")


class AuthorDetail(BaseModel):
    id: int
    name: str
    books: List[BookMinimal] = []
