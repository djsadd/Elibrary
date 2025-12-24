from pydantic import BaseModel, Field
from typing import List
from app.schemas.userbook import BookMinimal


class SubjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256, description="Название категории")


class SubjectUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256, description="Subject name")


class SubjectDetail(BaseModel):
    id: int
    name: str
    books: List[BookMinimal] = []
