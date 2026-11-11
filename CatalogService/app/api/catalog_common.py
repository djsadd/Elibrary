from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.book import Author, Book, Subject, UserBook
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


def _lang_fields(obj) -> list[str]:
    """name_ru/kk/en, plus description_ru/kk/en for models that have them (authors)."""
    fields = [f"name_{lang}" for lang in LANGS]
    fields += [f"description_{lang}" for lang in LANGS if hasattr(type(obj), f"description_{lang}")]
    return fields


def _i18n_fields(obj, *, with_description: bool = True) -> dict:
    out = {"id": obj.id, "name": obj.name}
    for field in _lang_fields(obj):
        if with_description or not field.startswith("description_"):
            out[field] = getattr(obj, field)
    return out


def _apply_i18n(obj, payload, *, only_set: bool = True) -> None:
    """Copy name_*/description_* from a payload onto obj (only fields that were sent)."""
    sent = payload.model_fields_set if only_set else set(type(payload).model_fields)
    for field in _lang_fields(obj):
        if field in sent and field in type(payload).model_fields:
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
        for field in _lang_fields(src):
            value = getattr(src, field)
            if value and not (getattr(target, field) or "").strip():
                setattr(target, field, value)
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
    items = [{**_i18n_fields(obj, with_description=False), "books_count": int(cnt or 0)} for obj, cnt in rows]
    return {"items": items, "page": {"limit": limit, "offset": offset, "total": total}}


def _books_count(db: Session, link_table, link_column: str, item_id: int) -> int:
    return int(
        db.query(func.count())
        .select_from(link_table)
        .filter(getattr(link_table.c, link_column) == item_id)
        .scalar()
        or 0
    )


def _delete_named(db: Session, model, link_table, link_column: str, item_id: int, label: str) -> None:
    """Delete an author/subject; refused (409) while books are still linked."""
    obj = db.get(model, item_id)
    if not obj:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    linked = _books_count(db, link_table, link_column, item_id)
    if linked:
        raise HTTPException(
            status_code=409,
            detail=f"{label} has {linked} linked book(s). Unlink or merge them first.",
        )
    db.delete(obj)
    db.commit()


def _counts(values) -> list[dict]:
    acc: dict[str, int] = {}
    for v in values:
        key = (str(v).strip() if v is not None else "") or "—"
        acc[key] = acc.get(key, 0) + 1
    return [{"key": k, "count": c} for k, c in sorted(acc.items(), key=lambda kv: (-kv[1], kv[0]))]


def _stats_named(db: Session, obj, related_attr: str) -> dict:
    """
    Analytics for an author/subject: books (public/hidden), reading activity from user_books,
    languages, formats, year range, and the most frequent related subjects (for authors)
    or authors (for subjects).
    """
    books = sorted(obj.books or [], key=lambda b: (b.title or "").lower())
    ids = [b.id for b in books]

    per_book: dict[int, dict[str, int]] = {}
    avg_progress = None
    if ids:
        rows = (
            db.query(UserBook.book_id, UserBook.status, func.count(UserBook.id))
            .filter(UserBook.book_id.in_(ids))
            .group_by(UserBook.book_id, UserBook.status)
            .all()
        )
        for book_id, status, cnt in rows:
            d = per_book.setdefault(book_id, {"readers": 0, "reading": 0, "readed": 0, "dropped": 0})
            d["readers"] += int(cnt)
            if status in d:
                d[status] += int(cnt)
        avg = db.query(func.avg(UserBook.progress_percent)).filter(UserBook.book_id.in_(ids)).scalar()
        avg_progress = round(float(avg), 1) if avg is not None else None

    def total(key: str) -> int:
        return sum(d[key] for d in per_book.values())

    years = sorted({str(b.year).strip() for b in books if b.year and str(b.year).strip()})
    year_range = None
    if years:
        year_range = years[0] if len(years) == 1 else f"{years[0]}–{years[-1]}"

    related = []
    for b in books:
        related.extend(r.name for r in (getattr(b, related_attr) or []))

    return {
        "books_total": len(books),
        "books_public": sum(1 for b in books if b.is_public),
        "books_hidden": sum(1 for b in books if not b.is_public),
        "readers_total": total("readers"),
        "reading": total("reading"),
        "finished": total("readed"),
        "dropped": total("dropped"),
        "avg_progress": avg_progress,
        "years": year_range,
        "by_lang": _counts(b.lang for b in books),
        "by_format": _counts(f for b in books for f in b.formats_list),
        "related": _counts(related)[:15],
        "books": [
            {
                "id": b.id,
                "title": b.title,
                "year": b.year,
                "lang": b.lang,
                "is_public": bool(b.is_public),
                "formats": b.formats_list,
                "readers": per_book.get(b.id, {}).get("readers", 0),
                "reading": per_book.get(b.id, {}).get("reading", 0),
                "finished": per_book.get(b.id, {}).get("readed", 0),
            }
            for b in books
        ],
    }
