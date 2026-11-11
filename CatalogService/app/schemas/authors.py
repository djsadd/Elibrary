from pydantic import BaseModel, Field
from typing import List, Optional
from app.schemas.userbook import BookMinimal
from app.schemas.common import Pagination


class AuthorI18n(BaseModel):
    name_ru: Optional[str] = Field(None, max_length=256)
    name_kk: Optional[str] = Field(None, max_length=256)
    name_en: Optional[str] = Field(None, max_length=256)


class AuthorTexts(AuthorI18n):
    description_ru: Optional[str] = Field(None, max_length=20000)
    description_kk: Optional[str] = Field(None, max_length=20000)
    description_en: Optional[str] = Field(None, max_length=20000)


class AuthorCreate(AuthorTexts):
    name: str = Field(..., min_length=1, max_length=256, description="Имя автора")


class AuthorUpdate(AuthorTexts):
    name: Optional[str] = Field(None, min_length=1, max_length=256, description="Имя автора")


class AuthorMerge(AuthorI18n):
    target_id: int = Field(..., description="Основная запись, в которую сливаются остальные")
    source_ids: List[int] = Field(..., min_length=1, description="Дубли, которые будут удалены")
    name: Optional[str] = Field(None, min_length=1, max_length=256, description="Новое основное название")


class AuthorDetail(BaseModel):
    id: int
    name: str
    name_ru: Optional[str] = None
    name_kk: Optional[str] = None
    name_en: Optional[str] = None
    description_ru: Optional[str] = None
    description_kk: Optional[str] = None
    description_en: Optional[str] = None
    books: List[BookMinimal] = []


class AuthorRow(AuthorI18n):
    id: int
    name: str
    books_count: int = 0


class AuthorPage(BaseModel):
    items: List[AuthorRow]
    page: Pagination
