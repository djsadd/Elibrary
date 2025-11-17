from pydantic import BaseModel, Field, HttpUrl, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime
from app.schemas.common import Pagination
from pydantic import field_validator

# --- Новые перечисления ---
BookSourceLiteral = Literal["KABIS", "LIBRARY", "RMEB", "IPRBOOKS", "OTHER"]


class BookCreate(BaseModel):
    title: str
    year: Optional[str] = None
    lang: Optional[str] = None
    pub_info: Optional[str] = None
    summary: Optional[str] = None
    cover: Optional[str] = None
    file_id: Optional[str] = None
    download_url: Optional[str] = None
    authors: List[str] = Field(default_factory=list)
    subjects: List[str] = Field(default_factory=list)

    # Новые поля
    source: Optional[BookSourceLiteral] = "LIBRARY"
    formats: List[str] = Field(default_factory=lambda: ["EBOOK"])
    isbn: Optional[str] = None
    edition: Optional[str] = None
    page_count: Optional[int] = None
    available_copies: Optional[int] = 1
    is_public: bool = True


class BookUpdate(BaseModel):
    title: Optional[str] = None
    year: Optional[str] = None
    lang: Optional[str] = None
    pub_info: Optional[str] = None
    summary: Optional[str] = None
    cover: Optional[str] = None
    file_id: Optional[str] = None
    download_url: Optional[str] = None
    authors: Optional[List[str]] = None
    subjects: Optional[List[str]] = None

    source: Optional[BookSourceLiteral] = None
    formats: Optional[List[str]] = None
    isbn: Optional[str] = None
    edition: Optional[str] = None
    page_count: Optional[int] = None
    available_copies: Optional[int] = None
    is_public: Optional[bool] = None


class AuthorOut(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class SubjectOut(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class BookOut(BaseModel):
    id: int
    title: str
    year: Optional[str]
    lang: Optional[str]
    pub_info: Optional[str]
    summary: Optional[str]
    cover: Optional[str]
    file_id: Optional[str]
    download_url: Optional[str]

    # Новые поля
    source: Optional[str] = None
    formats: List[str] = []

    @field_validator("formats", mode="before")
    def parse_formats(cls, v):
        if isinstance(v, str):
            return v.split(",")
        return v
    isbn: Optional[str] = None
    edition: Optional[str] = None
    page_count: Optional[int] = None
    available_copies: Optional[int] = None
    is_public: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    authors: List[AuthorOut] = []
    subjects: List[SubjectOut] = []

    model_config = ConfigDict(from_attributes=True)


class BookList(BaseModel):
    items: List[BookOut]
    page: Pagination
