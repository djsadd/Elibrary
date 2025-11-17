from sqlalchemy import Column, Integer, String, ForeignKey, Text, Float, DateTime, func
from app.core.db import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, index=True, nullable=False)
    user_id = Column(Integer, nullable=False)
    rating = Column(Float, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
