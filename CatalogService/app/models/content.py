from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ContentPage(Base):
    __tablename__ = "content_pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    menu_title: Mapped[str | None] = mapped_column(String(255))
    summary: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    created_at: Mapped[str] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[str] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    blocks = relationship(
        "PageBlock",
        back_populates="page",
        cascade="all, delete-orphan",
        order_by="PageBlock.sort_order.asc(), PageBlock.id.asc()",
    )
    menu_items = relationship("MenuItem", back_populates="page")


class PageBlock(Base):
    __tablename__ = "page_blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("content_pages.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(32), default="text", index=True)
    title: Mapped[str | None] = mapped_column(String(255))
    body: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(2048))
    link_label: Mapped[str | None] = mapped_column(String(255))
    link_url: Mapped[str | None] = mapped_column(String(2048))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)
    created_at: Mapped[str] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[str] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    page = relationship("ContentPage", back_populates="blocks")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    title_ru: Mapped[str | None] = mapped_column(String(255))
    title_kk: Mapped[str | None] = mapped_column(String(255))
    title_en: Mapped[str | None] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(2048))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("menu_items.id", ondelete="CASCADE"), index=True)
    page_id: Mapped[int | None] = mapped_column(ForeignKey("content_pages.id", ondelete="SET NULL"), index=True)
    external_url: Mapped[str | None] = mapped_column(String(2048))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[str] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[str] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    page = relationship("ContentPage", back_populates="menu_items")
    parent = relationship("MenuItem", remote_side="MenuItem.id", back_populates="children")
    children = relationship(
        "MenuItem",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="MenuItem.sort_order.asc(), MenuItem.id.asc()",
    )
