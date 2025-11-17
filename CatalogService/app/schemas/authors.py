from pydantic import BaseModel, Field


class AuthorCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256, description="Имя автора")
