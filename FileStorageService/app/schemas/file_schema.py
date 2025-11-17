from pydantic import BaseModel
from datetime import datetime


class FileResponse(BaseModel):
    id: int
    filename: str
    content_type: str | None
    size: int
    uploaded_at: datetime

    class Config:
        orm_mode = True
