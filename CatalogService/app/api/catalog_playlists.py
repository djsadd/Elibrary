from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.catalog_common import get_db
from app.models.book import Book, Playlist
from app.schemas.playlist import PlaylistCreate, PlaylistOut, PlaylistUpdate
from app.utils.authz import AuthUser, get_current_user, require_roles, is_staff

router = APIRouter()


@router.post("/playlists", response_model=PlaylistOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles("editor", "admin", "librarian"))])
def create_playlist(
    payload: PlaylistCreate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = Playlist(title=payload.title, description=payload.description)

    if payload.book_ids:
        books = db.query(Book).filter(Book.id.in_(payload.book_ids)).all()
        playlist.books = books

    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return _playlist_out(playlist, user)


@router.get("/playlists", response_model=list[PlaylistOut])
def list_playlists(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlists = db.query(Playlist).order_by(Playlist.created_at.desc()).all()
    return [_playlist_out(p, user) for p in playlists]


@router.get("/playlists/{playlist_id}", response_model=PlaylistOut)
def get_playlist(
    playlist_id: int,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return _playlist_out(playlist, user)


@router.put("/playlists/{playlist_id}", response_model=PlaylistOut, dependencies=[Depends(require_roles("editor", "admin", "librarian"))])
def update_playlist(
    playlist_id: int,
    payload: PlaylistUpdate,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if payload.title is not None:
        playlist.title = payload.title
    if payload.description is not None:
        playlist.description = payload.description
    if payload.book_ids is not None:
        books = db.query(Book).filter(Book.id.in_(payload.book_ids)).all()
        playlist.books = books

    db.commit()
    db.refresh(playlist)
    return _playlist_out(playlist, user)


@router.delete("/playlists/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_roles("editor", "admin", "librarian"))])
def delete_playlist(
    playlist_id: int,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    db.delete(playlist)
    db.commit()


def _playlist_out(playlist, user):
    from app.api.catalog_common import _to_out
    return PlaylistOut(id=playlist.id, title=playlist.title, description=playlist.description,
                       created_at=playlist.created_at, updated_at=playlist.updated_at,
                       books=[_to_out(b) for b in playlist.books if b.is_public or is_staff(user)])
