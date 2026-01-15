from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.catalog_common import get_db
from app.models.book import UserBookNote
from app.schemas.userbook_note import UserBookNoteCreate, UserBookNoteOut, UserBookNoteUpdate
from app.utils.authz import AuthUser, get_current_user

router = APIRouter()


@router.post("/notes", response_model=UserBookNoteOut)
def create_userbook_note(
    payload: UserBookNoteCreate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = UserBookNote(
        user_id=user.user_id,
        book_id=payload.book_id,
        page=payload.page,
        note=payload.note,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/notes/{note_id}", response_model=UserBookNoteOut)
def update_userbook_note(
    note_id: int,
    payload: UserBookNoteUpdate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = db.get(UserBookNote, note_id)
    if not note or note.user_id != user.user_id:
        raise HTTPException(404, "Note not found")

    for key, value in payload.dict(exclude_unset=True).items():
        setattr(note, key, value)

    db.commit()
    db.refresh(note)
    return note


@router.get("/notes", response_model=list[UserBookNoteOut])
def list_userbook_notes(
    user: AuthUser = Depends(get_current_user),
    book_id: Optional[int] = None,
    page: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(UserBookNote).filter(UserBookNote.user_id == user.user_id)
    if book_id:
        query = query.filter(UserBookNote.book_id == book_id)
    if page:
        query = query.filter(UserBookNote.page == page)
    return query.all()