from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.book import Author, Book, Subject
from app.schemas.authors import AuthorDetail
from app.schemas.book import AuthorOut, BookOut, SubjectOut
from app.schemas.subjects import SubjectDetail
from app.schemas.userbook import BookMinimal
from app.utils.i18n_names import LANGS, clean, fill_detected_lang


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _find_by_any_name(db: Session, model, name: str):
    """Find an author/subject whose main name or any translation matches (case-insensitive)."""
    lowered = name.lower()
    exact = db.query(model).filter(model.name == name).first()
    if exact:
        return exact
    return (
        db.query(model)
        .filter(
            or_(
                func.lower(model.name) == lowered,
                func.lower(model.name_ru) == lowered,
                func.lower(model.name_kk) == lowered,
                func.lower(model.name_en) == lowered,
            )
        )
        .order_by(model.id.asc())
        .first()
    )


def _ensure_named(db: Session, model, names: list[str]) -> list:
    out: list = []
    seen: set[int] = set()
    for name in names:
        name = (name or "").strip()
        if not name:
            continue
        obj = _find_by_any_name(db, model, name)
        if not obj:
            obj = model(name=name)
            fill_detected_lang(obj)
            db.add(obj)
            db.flush()
        if obj.id not in seen:
            seen.add(obj.id)
            out.append(obj)
    return out


def _ensure_authors(db: Session, names: list[str]) -> list[Author]:
    return _ensure_named(db, Author, names)


def _ensure_subjects(db: Session, names: list[str]) -> list[Subject]:
    return _ensure_named(db, Subject, names)


def _i18n_fields(obj) -> dict:
    return {
        "id": obj.id,
        "name": obj.name,
        "name_ru": obj.name_ru,
        "name_kk": obj.name_kk,
        "name_en": obj.name_en,
    }


def _apply_i18n(obj, payload, *, only_set: bool = True) -> None:
    """Copy name_ru/name_kk/name_en from a payload onto obj (only fields that were sent)."""
    sent = payload.model_fields_set if only_set else set(f"name_{l}" for l in LANGS)
    for lang in LANGS:
        field = f"name_{lang}"
        if field in sent:
            setattr(obj, field, clean(getattr(payload, field)))


def _merge_named(db: Session, model, relation: str, payload, label: str):
    """
    Merge duplicates (payload.source_ids) into payload.target_id:
    books are re-linked to the target, empty translations are taken from the
    duplicates, duplicates are deleted, then the new name / translations are applied.
    Returns (target, affected_book_ids). Does not commit.
    """
    target = db.get(model, payload.target_id)
    if not target:
        raise HTTPException(status_code=404, detail=f"{label} {payload.target_id} not found")

    source_ids = [sid for sid in dict.fromkeys(payload.source_ids) if sid != target.id]
    if not source_ids:
        raise HTTPException(status_code=400, detail="Nothing to merge: choose at least one duplicate")

    sources = db.query(model).filter(model.id.in_(source_ids)).all()
    missing = set(source_ids) - {s.id for s in sources}
    if missing:
        raise HTTPException(status_code=404, detail=f"{label} not found: {sorted(missing)}")

    affected: set[int] = set()
    for book in list(target.books or []):
        affected.add(book.id)

    for src in sources:
        for book in list(src.books or []):
            linked = getattr(book, relation)
            if target not in linked:
                linked.append(target)
            if src in linked:
                linked.remove(src)
            affected.add(book.id)
        # keep translations / old spelling of the duplicate if the target has none
        src_lang_names = {lang: getattr(src, f"name_{lang}") for lang in LANGS}
        for lang, value in src_lang_names.items():
            if value and not (getattr(target, f"name_{lang}") or "").strip():
                setattr(target, f"name_{lang}", value)
        db.delete(src)

    db.flush()  # free unique names of deleted duplicates before renaming

    new_name = clean(payload.name)
    if new_name:
        target.name = new_name
    _apply_i18n(target, payload)
    fill_detected_lang(target)
    db.flush()
    return target, sorted(affected)

def _to_out(b: Book) -> BookOut:
    return BookOut(
        id=b.id,
        is_public=b.is_public,
        title=b.title,
        year=b.year,
        lang=b.lang,
        pub_info=b.pub_info,
        summary=b.summary,
        cover=b.cover,
        file_id=b.file_id,
        download_url=b.download_url,
        external_url=b.external_url,
        source=b.source.value if b.source else None,
        formats=b.formats_list,
        authors=[AuthorOut.from_orm(a) for a in b.authors],
        subjects=[SubjectOut.from_orm(s) for s in b.subjects],
    )


def _author_to_detail(author: Author) -> AuthorDetail:
    books = [
        BookMinimal(
            id=b.id,
            title=b.title,
            cover=b.cover,
            authors=[{"id": a.id, "name": a.name} for a in b.authors],
            formats=b.formats_list,
        )
        for b in (author.books or []) if b.is_public
    ]
    return AuthorDetail(**_i18n_fields(author), books=books)


def _subject_to_detail(subject: Subject) -> SubjectDetail:
    books = [
        BookMinimal(
            id=b.id,
            title=b.title,
            cover=b.cover,
            authors=[{"id": a.id, "name": a.name} for a in b.authors],
            formats=b.formats_list,
        )
        for b in (subject.books or []) if b.is_public
    ]
    return SubjectDetail(**_i18n_fields(subject), books=books)

def _reindex_books(db: Session, book_ids: list[int], background_tasks) -> None:
    """Push renamed / merged authors and subjects to SearchService."""
    if not book_ids:
        return
    from app.services.search_sync import index_book_in_search

    books = db.query(Book).filter(Book.id.in_(book_ids)).all()
    for book in books:
        background_tasks.add_task(index_book_in_search, _to_out(book).model_dump())


def _name_search(query, model, q: str | None):
    """Filter by main name or any translation."""
    q = (q or "").strip()
    if not q:
        return query
    like = f"%{q}%"
    return query.filter(
        or_(
            model.name.ilike(like),
            model.name_ru.ilike(like),
            model.name_kk.ilike(like),
            model.name_en.ilike(like),
        )
    )


def _page_named(db: Session, model, link_table, link_column: str, q: str | None, limit: int, offset: int) -> dict:
    """Paginated authors/subjects with books count: {items: [...], page: {limit, offset, total}}."""
    base = _name_search(db.query(model), model, q)
    total = base.order_by(None).count()

    counts = (
        db.query(getattr(link_table.c, link_column).label("item_id"), func.count().label("cnt"))
        .group_by(getattr(link_table.c, link_column))
        .subquery()
    )
    rows = (
        _name_search(
            db.query(model, func.coalesce(counts.c.cnt, 0)).outerjoin(counts, counts.c.item_id == model.id),
            model,
            q,
        )
        .order_by(func.lower(model.name).asc(), model.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    items = [{**_i18n_fields(obj), "books_count": int(cnt or 0)} for obj, cnt in rows]
    return {"items": items, "page": {"limit": limit, "offset": offset, "total": total}}
