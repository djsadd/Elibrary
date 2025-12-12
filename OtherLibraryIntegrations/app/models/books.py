from sqlalchemy import Column, Integer, String
from app.core.db import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    id_book = Column(Integer, nullable=False)
    source = Column(String, nullable=False)
