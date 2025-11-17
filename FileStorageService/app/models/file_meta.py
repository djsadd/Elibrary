from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class FileMeta(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(256), nullable=False)
    content_type = Column(String(64))
    size = Column(Integer)
    storage_path = Column(String(512))
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
