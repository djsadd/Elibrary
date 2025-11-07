from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, func, Table, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.core.db import Base

# m2m таблицы
book_authors = Table(
    "book_authors",
    Base.metadata,
    Column("book_id", ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
    Column("author_id", ForeignKey("authors.id", ondelete="CASCADE"), primary_key=True),
)

book_subjects = Table(
    "book_subjects",
    Base.metadata,
    Column("book_id", ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
    Column("subject_id", ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True),
)

class Book(Base):
    __tablename__ = "books"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(512), index=True)
    year: Mapped[str | None] = mapped_column(String(10))
    lang: Mapped[str | None] = mapped_column(String(16), index=True)
    pub_info: Mapped[str | None] = mapped_column(String(512))
    summary: Mapped[str | None] = mapped_column(Text)
    cover: Mapped[str | None] = mapped_column(String(1024))
    file_id: Mapped[str | None] = mapped_column(String(128))
    download_url: Mapped[str | None] = mapped_column(String(2048))
    created_at: Mapped[str] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[str] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    authors = relationship("Author", secondary=book_authors, back_populates="books", lazy="joined")
    subjects = relationship("Subject", secondary=book_subjects, back_populates="books", lazy="joined")


class Author(Base):
    __tablename__ = "authors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(256), index=True, nullable=False, unique=True)
    books = relationship("Book", secondary=book_authors, back_populates="authors")

    __table_args__ = (UniqueConstraint("name", name="uq_authors_name"),)


class Subject(Base):
    __tablename__ = "subjects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(256), index=True, nullable=False, unique=True)
    books = relationship("Book", secondary=book_subjects, back_populates="subjects")

    __table_args__ = (UniqueConstraint("name", name="uq_subjects_name"),)
