from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Float, func, Table, UniqueConstraint, Enum, Boolean
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.core.db import Base
from datetime import datetime
import enum
from typing import List

# --- m2m таблицы ---
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

playlist_books = Table(
    "playlist_books",
    Base.metadata,
    Column("playlist_id", ForeignKey("playlists.id", ondelete="CASCADE"), primary_key=True),
    Column("book_id", ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
)


class BookSource(enum.Enum):
    KABIS = "KABIS"
    LIBRARY = "LIBRARY"
    RMEB = "RMEB"
    IPRBOOKS = "IPRBOOKS"
    OTHER = "OTHER"


class BookFormat(enum.Enum):
    HARDCOPY = "HARDCOPY"
    EBOOK = "EBOOK"
    AUDIOBOOK = "AUDIOBOOK"
    VIDEOBOOK = "VIDEOBOOK"
    INTERACTIVE = "INTERACTIVE"  # например, с тестами/мультимедиа


# --- модели ---

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

    source: Mapped[BookSource] = mapped_column(Enum(BookSource), default=BookSource.LIBRARY, index=True)
    formats: Mapped[str] = mapped_column(String(256), default="EBOOK")

    isbn: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    edition: Mapped[str | None] = mapped_column(String(128))  # издание (например, "2-е издание, исправленное")
    page_count: Mapped[int | None] = mapped_column(Integer)
    available_copies: Mapped[int | None] = mapped_column(Integer, default=1)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)  # доступна ли книга пользователям

    created_at: Mapped[str] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[str] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    user_books = relationship("UserBook", back_populates="book", cascade="all, delete-orphan")
    authors = relationship("Author", secondary=book_authors, back_populates="books", lazy="joined")
    subjects = relationship("Subject", secondary=book_subjects, back_populates="books", lazy="joined")
    playlists = relationship("Playlist", secondary=playlist_books, back_populates="books")

    @property
    def formats_list(self) -> List[str]:
        return [f.strip() for f in (self.formats or "").split(",") if f.strip()]

    @formats_list.setter
    def formats_list(self, values: List[str]):
        self.formats = ",".join(values)


class UserBook(Base):
    __tablename__ = "user_books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(Integer, index=True)  # просто id из другого сервиса
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True)

    current_page: Mapped[int | None] = mapped_column(Integer)
    total_pages: Mapped[int | None] = mapped_column(Integer)
    progress_percent: Mapped[float | None] = mapped_column(Float)

    started_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    last_opened_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    reading_time: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str | None] = mapped_column(String(32))

    book = relationship("Book", back_populates="user_books")
    notes = relationship("UserBookNote", back_populates="userbook", cascade="all, delete-orphan")


class UserBookNote(Base):
    __tablename__ = "userbook_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(Integer, index=True)
    book_id: Mapped[int] = mapped_column(Integer, index=True)

    userbook_id: Mapped[int | None] = mapped_column(ForeignKey("user_books.id", ondelete="CASCADE"), nullable=True)

    page: Mapped[int | None] = mapped_column(Integer)  # страница, к которой относится заметка
    note: Mapped[str] = mapped_column(Text)  # текст заметки
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    userbook = relationship("UserBook", back_populates="notes")


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


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[str] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    books = relationship("Book", secondary=playlist_books, back_populates="playlists")
