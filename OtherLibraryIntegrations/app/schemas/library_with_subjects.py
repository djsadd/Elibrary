from pydantic import BaseModel
from typing import Optional


class LibraryWithSubjectsOut(BaseModel):
    id: int
    post_id: Optional[int]
    post_title: str
    level: Optional[int]
    path_ids: Optional[str]
    path_titles: Optional[str]
    pdf_id: Optional[str]
    pdf_url: Optional[str]
    file_is_indexed: bool
    title_is_indexed: bool
    is_integrated: bool
    file_is_downloaded: bool
    timestamp: float

    class Config:
        from_attributes = True
