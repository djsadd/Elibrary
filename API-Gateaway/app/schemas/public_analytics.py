from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PublicPageViewIn(BaseModel):
    path: str = Field(..., min_length=1, max_length=512)
    title: Optional[str] = Field(default=None, max_length=200)
    referrer: Optional[str] = Field(default=None, max_length=512)

    @field_validator("path")
    @classmethod
    def validate_path(cls, v: str) -> str:
        v = (v or "").strip()
        if not v.startswith("/"):
            raise ValueError("path must start with '/'")
        # Only public pages should be tracked via this endpoint.
        if not (v == "/public" or v.startswith("/public/")):
            raise ValueError("path must be under /public")
        if v.startswith("/public//"):
            v = v.replace("//", "/")
        return v

