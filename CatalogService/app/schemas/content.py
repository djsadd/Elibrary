from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, validator, field_validator


class SafeLinks(BaseModel):
    @field_validator("image_url", "link_url", "external_url", check_fields=False)
    @classmethod
    def validate_link(cls, value):
        from app.utils.html_sanitizer import _is_safe_url
        if value and not _is_safe_url(value):
            raise ValueError("Unsafe URL scheme")
        return value


class PageBlockBase(SafeLinks):
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


class PageBlockUpdate(SafeLinks):
    type: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    link_label: Optional[str] = None
    link_url: Optional[str] = None
    sort_order: Optional[int] = None


class PageBlockOut(PageBlockBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    page_id: int
    created_at: datetime
    updated_at: datetime


class ContentPageBase(BaseModel):
    @field_validator("content_html", "content_html_ru", "content_html_kk", "content_html_en", mode="before", check_fields=False)
    @classmethod
    def clean_content(cls, value):
        from app.utils.html_sanitizer import sanitize_html
        return sanitize_html(value)

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
    @field_validator("content_html", "content_html_ru", "content_html_kk", "content_html_en", mode="before", check_fields=False)
    @classmethod
    def clean_content(cls, value):
        from app.utils.html_sanitizer import sanitize_html
        return sanitize_html(value)

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
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    blocks: List[PageBlockOut] = []


class MenuItemBase(SafeLinks):
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


class MenuItemUpdate(SafeLinks):
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
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class MenuItemTree(MenuItemOut):
    page_slug: Optional[str] = None
    path: Optional[str] = None
    children: List["MenuItemTree"] = []


class ContentSummary(BaseModel):
    pages: List[ContentPageOut]
    menu_items: List[MenuItemTree]


MenuItemTree.update_forward_refs()
