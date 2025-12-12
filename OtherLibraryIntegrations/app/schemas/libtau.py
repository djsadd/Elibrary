from pydantic import BaseModel


class LibraryWithSubjectsOut(BaseModel):
    id: int
    post_id: int | None
    post_title: str
    level: int | None
    path_ids: str | None
    path_titles: str | None
    pdf_id: str | None
    pdf_url: str | None
    file_is_indexed: bool
    title_is_indexed: bool
    is_integrated: bool
    timestamp: float

    class Config:
        orm_mode = True