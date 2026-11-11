from typing import List, Optional

from pydantic import BaseModel


class Pagination(BaseModel):
    limit: int
    offset: int
    total: int


class TaxonomyStatsBook(BaseModel):
    id: int
    title: str
    year: Optional[str] = None
    lang: Optional[str] = None
    is_public: bool = True
    formats: List[str] = []
    readers: int = 0
    reading: int = 0
    finished: int = 0


class NamedCount(BaseModel):
    key: str
    count: int


class TaxonomyStats(BaseModel):
    books_total: int
    books_public: int
    books_hidden: int
    readers_total: int
    reading: int
    finished: int
    dropped: int
    avg_progress: Optional[float] = None
    years: Optional[str] = None
    by_lang: List[NamedCount] = []
    by_format: List[NamedCount] = []
    related: List[NamedCount] = []
    books: List[TaxonomyStatsBook] = []
