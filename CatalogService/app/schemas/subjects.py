from pydantic import BaseModel, Field
from typing import List, Optional
from app.schemas.userbook import BookMinimal


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


class SubjectDetail(BaseModel):
    id: int
    name: str
    name_ru: Optional[str] = None
    name_kk: Optional[str] = None
    name_en: Optional[str] = None
    books: List[BookMinimal] = []
