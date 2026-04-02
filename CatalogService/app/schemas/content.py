from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class PageBlockBase(BaseModel):
    type: str = Field(default="text")
    title: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    link_label: Optional[str] = None
    link_url: Optional[str] = None
    sort_order: int = 0

    @validator("type")
    def validate_type(cls, value: str) -> str:
        allowed = {"text", "image", "hero", "cta"}
        normalized = (value or "text").strip().lower()
        if normalized not in allowed:
            raise ValueError(f"type must be one of {', '.join(sorted(allowed))}")
        return normalized


class PageBlockCreate(PageBlockBase):
    pass


class PageBlockUpdate(BaseModel):
    type: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    link_label: Optional[str] = None
    link_url: Optional[str] = None
    sort_order: Optional[int] = None


class PageBlockOut(PageBlockBase):
    id: int
    page_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ContentPageBase(BaseModel):
    title: str
    title_ru: Optional[str] = None
    title_kk: Optional[str] = None
    title_en: Optional[str] = None
    slug: str
    menu_title: Optional[str] = None
    menu_title_ru: Optional[str] = None
    menu_title_kk: Optional[str] = None
    menu_title_en: Optional[str] = None
    summary: Optional[str] = None
    summary_ru: Optional[str] = None
    summary_kk: Optional[str] = None
    summary_en: Optional[str] = None
    content_html: Optional[str] = None
    content_html_ru: Optional[str] = None
    content_html_kk: Optional[str] = None
    content_html_en: Optional[str] = None
    status: str = "draft"

    @validator("slug")
    def validate_slug(cls, value: str) -> str:
        slug = (value or "").strip().strip("/")
        if not slug:
            raise ValueError("slug is required")
        return slug

    @validator("status")
    def validate_status(cls, value: str) -> str:
        allowed = {"draft", "published"}
        normalized = (value or "draft").strip().lower()
        if normalized not in allowed:
            raise ValueError("status must be draft or published")
        return normalized


class ContentPageCreate(ContentPageBase):
    pass


class ContentPageUpdate(BaseModel):
    title: Optional[str] = None
    title_ru: Optional[str] = None
    title_kk: Optional[str] = None
    title_en: Optional[str] = None
    slug: Optional[str] = None
    menu_title: Optional[str] = None
    menu_title_ru: Optional[str] = None
    menu_title_kk: Optional[str] = None
    menu_title_en: Optional[str] = None
    summary: Optional[str] = None
    summary_ru: Optional[str] = None
    summary_kk: Optional[str] = None
    summary_en: Optional[str] = None
    content_html: Optional[str] = None
    content_html_ru: Optional[str] = None
    content_html_kk: Optional[str] = None
    content_html_en: Optional[str] = None
    status: Optional[str] = None


class ContentPageOut(ContentPageBase):
    id: int
    created_at: datetime
    updated_at: datetime
    blocks: List[PageBlockOut] = []

    class Config:
        orm_mode = True


class MenuItemBase(BaseModel):
    title: str
    title_ru: Optional[str] = None
    title_kk: Optional[str] = None
    title_en: Optional[str] = None
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[int] = None
    page_id: Optional[int] = None
    external_url: Optional[str] = None
    sort_order: int = 0
    is_visible: bool = True

    @validator("slug")
    def validate_menu_slug(cls, value: str) -> str:
        slug = (value or "").strip().strip("/")
        if not slug:
            raise ValueError("slug is required")
        return slug


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemUpdate(BaseModel):
    title: Optional[str] = None
    title_ru: Optional[str] = None
    title_kk: Optional[str] = None
    title_en: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[int] = None
    page_id: Optional[int] = None
    external_url: Optional[str] = None
    sort_order: Optional[int] = None
    is_visible: Optional[bool] = None


class MenuItemOut(MenuItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class MenuItemTree(MenuItemOut):
    page_slug: Optional[str] = None
    path: Optional[str] = None
    children: List["MenuItemTree"] = []


class ContentSummary(BaseModel):
    pages: List[ContentPageOut]
    menu_items: List[MenuItemTree]


MenuItemTree.update_forward_refs()
