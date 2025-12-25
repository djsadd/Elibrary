from pydantic import BaseModel
from typing import List, Optional

from app.schemas.userbook import BookMinimal
from app.schemas.common import Pagination


class FileWithBooksOut(BaseModel):
    file_id: str
    download_url: Optional[str] = None
    books: List[BookMinimal] = []


class FilesList(BaseModel):
    items: List[FileWithBooksOut]
    page: Pagination
