from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.catalog_common import _subject_to_detail, get_db
from app.models.book import Subject
from app.schemas.book import SubjectOut
from app.schemas.subjects import SubjectCreate, SubjectDetail, SubjectUpdate
from app.utils.authz import AuthUser, get_current_user

router = APIRouter()


@router.post("/subjects", response_model=str, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = Subject(name=payload.name.strip())

    db.add(subject)
    try:
        db.commit()
        db.refresh(subject)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subject '{payload.name}' already exists.",
        )

    return subject.name


@router.patch("/subjects/{subject_id}", response_model=SubjectDetail)
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    new_name = payload.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Subject name is required")

    subject.name = new_name
    try:
        db.commit()
        db.refresh(subject)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Subject '{payload.name}' already exists.",
        )

    return _subject_to_detail(subject)


@router.get("/subjects", response_model=list[str])
def list_subjects(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    query = db.query(Subject)
    if q:
        query = query.filter(Subject.name.ilike(f"%{q}%"))
    subjects = query.order_by(Subject.name.asc()).limit(limit).all()
    return [s.name for s in subjects]


@router.get("/subjects/details", response_model=list[SubjectOut])
def list_subjects_details(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    query = db.query(Subject)
    if q:
        query = query.filter(Subject.name.ilike(f"%{q}%"))
    subjects = query.order_by(Subject.name.asc()).limit(limit).all()
    return subjects


@router.get("/subjects/{subject_id}", response_model=SubjectDetail)
def get_subject(
    subject_id: int,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return _subject_to_detail(subject)
