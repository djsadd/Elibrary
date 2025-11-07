from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional
from app.schemas.common import Pagination


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
    authors: List[str]
    subjects: List[str]

    class Config:
        from_attributes = True


class BookList(BaseModel):
    items: List[BookOut]
    page: Pagination
