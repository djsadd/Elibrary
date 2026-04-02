from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, selectinload

from app.api.catalog_common import get_db
from app.models.content import ContentPage, MenuItem, PageBlock
from app.schemas.content import (
    ContentPageCreate,
    ContentPageOut,
    ContentPageUpdate,
    ContentSummary,
    MenuItemCreate,
    MenuItemOut,
    MenuItemTree,
    MenuItemUpdate,
    PageBlockCreate,
    PageBlockOut,
    PageBlockUpdate,
)
from app.utils.html_sanitizer import sanitize_html
from app.utils.authz import require_roles

router = APIRouter()


def _get_page_or_404(db: Session, page_id: int) -> ContentPage:
    page = (
        db.query(ContentPage)
        .options(selectinload(ContentPage.blocks))
        .filter(ContentPage.id == page_id)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


def _get_menu_item_or_404(db: Session, item_id: int) -> MenuItem:
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return item


def _get_block_or_404(db: Session, block_id: int) -> PageBlock:
    block = db.query(PageBlock).filter(PageBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Page block not found")
    return block


def _page_by_slug(db: Session, slug: str) -> ContentPage | None:
    return (
        db.query(ContentPage)
        .options(selectinload(ContentPage.blocks))
        .filter(ContentPage.slug == slug)
        .first()
    )


def _serialize_tree(items: list[MenuItem], parent_id: int | None = None, include_hidden: bool = False) -> list[MenuItemTree]:
    children = [
        item
        for item in items
        if item.parent_id == parent_id and (include_hidden or item.is_visible)
    ]
    children.sort(key=lambda item: (item.sort_order, item.id))
    return [
        MenuItemTree(
            id=item.id,
            title=item.title,
            title_ru=item.title_ru,
            title_kk=item.title_kk,
            title_en=item.title_en,
            slug=item.slug,
            description=item.description,
            image_url=item.image_url,
            parent_id=item.parent_id,
            page_id=item.page_id,
            external_url=item.external_url,
            sort_order=item.sort_order,
            is_visible=item.is_visible,
            created_at=item.created_at,
            updated_at=item.updated_at,
            page_slug=item.page.slug if item.page else None,
            path=item.external_url or (f"/public/page/{item.page.slug}" if item.page else None),
            children=_serialize_tree(items, item.id, include_hidden=include_hidden),
        )
        for item in children
    ]


@router.get(
    "/admin/content",
    response_model=ContentSummary,
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def get_content_admin_summary(db: Session = Depends(get_db)):
    pages = db.query(ContentPage).options(selectinload(ContentPage.blocks)).order_by(ContentPage.updated_at.desc()).all()
    items = db.query(MenuItem).order_by(MenuItem.sort_order.asc(), MenuItem.id.asc()).all()
    return ContentSummary(pages=pages, menu_items=_serialize_tree(items, include_hidden=True))


@router.post(
    "/admin/content/pages",
    response_model=ContentPageOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def create_content_page(payload: ContentPageCreate, db: Session = Depends(get_db)):
    existing = _page_by_slug(db, payload.slug)
    if existing:
        raise HTTPException(status_code=409, detail="Page slug already exists")
    data = payload.dict()
    data["content_html"] = sanitize_html(data.get("content_html"))
    page = ContentPage(**data)
    db.add(page)
    db.commit()
    db.refresh(page)
    return _get_page_or_404(db, page.id)


@router.put(
    "/admin/content/pages/{page_id}",
    response_model=ContentPageOut,
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def update_content_page(page_id: int, payload: ContentPageUpdate, db: Session = Depends(get_db)):
    page = _get_page_or_404(db, page_id)
    data = payload.dict(exclude_unset=True)
    if "slug" in data:
        conflict = _page_by_slug(db, data["slug"])
        if conflict and conflict.id != page_id:
            raise HTTPException(status_code=409, detail="Page slug already exists")
    if "content_html" in data:
        data["content_html"] = sanitize_html(data.get("content_html"))
    for key, value in data.items():
        setattr(page, key, value)
    db.add(page)
    db.commit()
    db.refresh(page)
    return _get_page_or_404(db, page.id)


@router.delete(
    "/admin/content/pages/{page_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def delete_content_page(page_id: int, db: Session = Depends(get_db)):
    page = _get_page_or_404(db, page_id)
    db.delete(page)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/admin/content/pages/{page_id}/blocks",
    response_model=PageBlockOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def create_page_block(page_id: int, payload: PageBlockCreate, db: Session = Depends(get_db)):
    _get_page_or_404(db, page_id)
    block = PageBlock(page_id=page_id, **payload.dict())
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@router.put(
    "/admin/content/blocks/{block_id}",
    response_model=PageBlockOut,
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def update_page_block(block_id: int, payload: PageBlockUpdate, db: Session = Depends(get_db)):
    block = _get_block_or_404(db, block_id)
    for key, value in payload.dict(exclude_unset=True).items():
        setattr(block, key, value)
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@router.delete(
    "/admin/content/blocks/{block_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def delete_page_block(block_id: int, db: Session = Depends(get_db)):
    block = _get_block_or_404(db, block_id)
    db.delete(block)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/admin/content/menu",
    response_model=MenuItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def create_menu_item(payload: MenuItemCreate, db: Session = Depends(get_db)):
    existing = db.query(MenuItem).filter(MenuItem.slug == payload.slug).first()
    if existing:
        raise HTTPException(status_code=409, detail="Menu slug already exists")
    item = MenuItem(**payload.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put(
    "/admin/content/menu/{item_id}",
    response_model=MenuItemOut,
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def update_menu_item(item_id: int, payload: MenuItemUpdate, db: Session = Depends(get_db)):
    item = _get_menu_item_or_404(db, item_id)
    data = payload.dict(exclude_unset=True)
    if "slug" in data:
        conflict = db.query(MenuItem).filter(MenuItem.slug == data["slug"]).first()
        if conflict and conflict.id != item_id:
            raise HTTPException(status_code=409, detail="Menu slug already exists")
    if data.get("parent_id") == item_id:
        raise HTTPException(status_code=400, detail="Menu item cannot be its own parent")
    for key, value in data.items():
        setattr(item, key, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/admin/content/menu/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin", "librarian"))],
)
def delete_menu_item(item_id: int, db: Session = Depends(get_db)):
    item = _get_menu_item_or_404(db, item_id)
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/public/content/menu", response_model=list[MenuItemTree])
def get_public_content_menu(db: Session = Depends(get_db)):
    items = (
        db.query(MenuItem)
        .filter(MenuItem.is_visible.is_(True))
        .order_by(MenuItem.sort_order.asc(), MenuItem.id.asc())
        .all()
    )
    return _serialize_tree(items)


@router.get("/public/content/pages/{slug}", response_model=ContentPageOut)
def get_public_content_page(slug: str, db: Session = Depends(get_db)):
    page = _page_by_slug(db, slug)
    if not page or page.status != "published":
        raise HTTPException(status_code=404, detail="Page not found")
    return page
