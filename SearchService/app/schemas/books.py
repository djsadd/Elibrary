from typing import Any

from pydantic import BaseModel, Field


class BookDoc(BaseModel):
    id: int
    title: str
    authors: list[str] = Field(default_factory=list)
    subjects: list[str] = Field(default_factory=list)

    lang: str | None = None
    year: str | None = None
    summary: str | None = None
    cover: str | None = None
    popularity: int = 0

    @classmethod
    def from_catalog(cls, payload: dict[str, Any]) -> "BookDoc":
        def _names(items: Any) -> list[str]:
            out: list[str] = []
            for item in items or []:
                if isinstance(item, str):
                    name = item
                elif isinstance(item, dict):
                    name = item.get("name")
                else:
                    name = getattr(item, "name", None)
                if name and str(name).strip():
                    out.append(str(name).strip())
            return out

        authors = _names(payload.get("authors"))
        subjects = _names(payload.get("subjects"))
        return cls(
            id=int(payload["id"]),
            title=str(payload.get("title") or ""),
            authors=authors,
            subjects=subjects,
            lang=payload.get("lang"),
            year=payload.get("year"),
            summary=payload.get("summary"),
            cover=payload.get("cover"),
            popularity=int(payload.get("popularity") or 0),
        )


class Page(BaseModel):
    limit: int
    offset: int
    total: int


class SearchResponse(BaseModel):
    items: list[BookDoc]
    page: Page


class SuggestItem(BaseModel):
    id: int
    title: str
    authors: list[str] = Field(default_factory=list)


class SuggestResponse(BaseModel):
    q: str
    items: list[SuggestItem]
