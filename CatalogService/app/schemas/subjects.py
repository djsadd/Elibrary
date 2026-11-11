from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from app.schemas.userbook import BookMinimal
from app.schemas.common import Pagination


class SubjectI18n(BaseModel):
    name_ru: Optional[str] = Field(None, max_length=256)
    name_kk: Optional[str] = Field(None, max_length=256)
    name_en: Optional[str] = Field(None, max_length=256)


class SubjectCreate(SubjectI18n):
    name: str = Field(..., min_length=1, max_length=256, description="Название категории")


class SubjectUpdate(SubjectI18n):
    name: Optional[str] = Field(None, min_length=1, max_length=256, description="Название категории")


class SubjectMerge(SubjectI18n):
    target_id: int = Field(..., description="Основная запись, в которую сливаются остальные")
    source_ids: List[int] = Field(..., min_length=1, description="Дубли, которые будут удалены")
    name: Optional[str] = Field(None, min_length=1, max_length=256, description="Новое основное название")


class SubjectToLanguage(BaseModel):
    lang: Literal["Russian", "English", "Kazakh"] = Field(..., description="Язык, который получат все книги категории")


class SubjectToLanguageResult(BaseModel):
    updated_books: int


class SubjectDetail(BaseModel):
    id: int
    name: str
    name_ru: Optional[str] = None
    name_kk: Optional[str] = None
    name_en: Optional[str] = None
    books: List[BookMinimal] = []


class SubjectRow(SubjectI18n):
    id: int
    name: str
    books_count: int = 0


class SubjectPage(BaseModel):
    items: List[SubjectRow]
    page: Pagination
