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
    subject_rows = db.query(Subject).order_by(Subject.name).all()
    subjects = [s.name for s in subject_rows]
    # translations so the UI can show a category in the selected language (the filter value stays `name`)
    subject_items = [
        {"name": s.name, "name_ru": s.name_ru, "name_kk": s.name_kk, "name_en": s.name_en}
        for s in subject_rows
    ]
    langs = ["Russian", "English", "Kazakh"]
    years = [y for (y,) in db.query(Book.year).distinct().order_by(Book.year.desc()).all() if y]

    return {
        "authors": authors,
        "subjects": subjects,
        "subject_items": subject_items,
        "langs": langs,
        "years": years,
    }


@router.get("/langs")
def list_langs(user: AuthUser = Depends(get_current_user)):
    return ["Russian", "English", "Kazakh"]
