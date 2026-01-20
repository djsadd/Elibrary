from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.catalog_common import get_db
from app.models.book import Author, Book, Subject
from app.utils.authz import AuthUser, get_current_user

router = APIRouter()


@router.get("/filters")
def get_filters(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    authors = [a.name for a in db.query(Author).order_by(Author.name).all()]
    subjects = [s.name for s in db.query(Subject).order_by(Subject.name).all()]
    langs = ["Russian", "English", "Kazakh"]
    years = [y for (y,) in db.query(Book.year).distinct().order_by(Book.year.desc()).all() if y]

    return {
        "authors": authors,
        "subjects": subjects,
        "langs": langs,
        "years": years,
    }


@router.get("/langs")
def list_langs(user: AuthUser = Depends(get_current_user)):
    return ["Russian", "English", "Kazakh"]
