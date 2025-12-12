import uuid

from sqlalchemy import Column, String, Boolean, Float, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import expression

from app.core.db import Base


class Library(Base):
    __tablename__ = "library_books"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    pdf_id = Column(String, unique=True, nullable=False)
    download_url = Column(String, nullable=True)
    book_id = Column(Integer, nullable=True)
    file_is_indexed = Column(Boolean, default=False)
    title_is_indexed = Column(Boolean, default=False)
    is_integrated = Column(Boolean, default=False, server_default=expression.false())
    timestamp = Column(Float, nullable=False)


class LibraryWithSubjects(Base):
    __tablename__ = "library_books_subjects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(Integer, nullable=True)
    post_title = Column(String(500), nullable=False)
    level = Column(Integer, nullable=True)
    path_ids = Column(String(200), nullable=True)
    path_titles = Column(String(500), nullable=True)
    pdf_id = Column(String(100), nullable=True, unique=True)
    pdf_url = Column(String(1000), nullable=True)

    file_is_indexed = Column(Boolean, default=False)
    title_is_indexed = Column(Boolean, default=False)
    is_integrated = Column(Boolean, default=False)
    timestamp = Column(Float, nullable=False)
    file_is_downloaded = Column(Boolean, default=False)

    def __repr__(self):
        return f"<LibraryWithSubjects(pdf_id={self.pdf_id}, title={self.post_title})>"
