from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.catalog_common import get_db
from app.models.book import Author, Book, Subject

router = APIRouter()


@router.get("/filters")
def get_filters(db: Session = Depends(get_db)):
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
def list_langs():
    return ["Russian", "English", "Kazakh"]