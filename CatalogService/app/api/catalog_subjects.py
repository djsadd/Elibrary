from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.catalog_common import (
    _apply_i18n,
    _subject_to_detail,
    _merge_named,
    _reindex_books,
    get_db,
)
from app.models.book import Subject
from app.schemas.subjects import SubjectCreate, SubjectDetail, SubjectMerge, SubjectUpdate
from app.schemas.book import SubjectOut
from app.utils.authz import AuthUser, get_current_user, require_roles
from app.utils.i18n_names import fill_detected_lang

router = APIRouter()

STAFF = Depends(require_roles("editor", "admin", "librarian"))


def _search(query, q: Optional[str]):
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Subject.name.ilike(like),
                Subject.name_ru.ilike(like),
                Subject.name_kk.ilike(like),
                Subject.name_en.ilike(like),
            )
        )
    return query


@router.get("/subjects", response_model=list[str])
def list_subjects(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    subjects = _search(db.query(Subject), q).order_by(Subject.name.asc()).limit(limit).all()
    return [a.name for a in subjects]


@router.get("/subjects/details", response_model=list[SubjectOut])
def list_subjects_details(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    subjects = _search(db.query(Subject), q).order_by(Subject.name.asc()).limit(limit).all()
    return subjects


@router.post("/subjects", response_model=str, status_code=status.HTTP_201_CREATED, dependencies=[STAFF])
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)):
    subject = Subject(name=payload.name.strip())
    _apply_i18n(subject, payload)
    fill_detected_lang(subject)
    db.add(subject)
    try:
        db.commit()
        db.refresh(subject)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Subject '{payload.name}' already exists.")
    return subject.name


@router.post("/subjects/merge", response_model=SubjectDetail, dependencies=[STAFF])
def merge_subjects(payload: SubjectMerge, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Объединить дубли категорий в одну и сразу присвоить новое название."""
    target, book_ids = _merge_named(db, Subject, "subjects", payload, "Subject")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Subject '{payload.name}' already exists.")
    db.refresh(target)
    _reindex_books(db, book_ids, background_tasks)
    return _subject_to_detail(target)


@router.get("/subjects/{subject_id}", response_model=SubjectDetail)
def get_subject(subject_id: int, user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return _subject_to_detail(subject)


@router.patch("/subjects/{subject_id}", response_model=SubjectDetail, dependencies=[STAFF])
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if payload.name is not None:
        new_name = payload.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Subject name is required")
        subject.name = new_name
    _apply_i18n(subject, payload)

    try:
        db.commit()
        db.refresh(subject)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Subject '{payload.name}' already exists.")

    _reindex_books(db, [b.id for b in subject.books or []], background_tasks)
    return _subject_to_detail(subject)
