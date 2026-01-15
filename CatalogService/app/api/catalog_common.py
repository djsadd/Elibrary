from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.book import Author, Book, Subject
from app.schemas.authors import AuthorDetail
from app.schemas.book import AuthorOut, BookOut, SubjectOut
from app.schemas.subjects import SubjectDetail
from app.schemas.userbook import BookMinimal


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_authors(db: Session, names: list[str]) -> list[Author]:
    out: list[Author] = []
    for name in names:
        name = name.strip()
        if not name:
            continue
        obj = db.query(Author).filter(Author.name == name).first()
        if not obj:
            obj = Author(name=name)
            db.add(obj)
            db.flush()
        out.append(obj)
    return out


def _ensure_subjects(db: Session, names: list[str]) -> list[Subject]:
    out: list[Subject] = []
    for name in names:
        name = name.strip()
        if not name:
            continue
        obj = db.query(Subject).filter(Subject.name == name).first()
        if not obj:
            obj = Subject(name=name)
            db.add(obj)
            db.flush()
        out.append(obj)
    return out


def _to_out(b: Book) -> BookOut:
    return BookOut(
        id=b.id,
        title=b.title,
        year=b.year,
        lang=b.lang,
        pub_info=b.pub_info,
        summary=b.summary,
        cover=b.cover,
        file_id=b.file_id,
        download_url=b.download_url,
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
        for b in (author.books or [])
    ]
    return AuthorDetail(id=author.id, name=author.name, books=books)


def _subject_to_detail(subject: Subject) -> SubjectDetail:
    books = [
        BookMinimal(
            id=b.id,
            title=b.title,
            cover=b.cover,
            authors=[{"id": a.id, "name": a.name} for a in b.authors],
            formats=b.formats_list,
        )
        for b in (subject.books or [])
    ]
    return SubjectDetail(id=subject.id, name=subject.name, books=books)