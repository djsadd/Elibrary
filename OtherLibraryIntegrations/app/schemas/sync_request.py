from pydantic import BaseModel
from typing import List

class BookSchema(BaseModel):
    title: str
    author: str
    isbn: str

class SyncRequest(BaseModel):
    books: List[BookSchema]
