# app/models/user.py
from sqlalchemy import Column, Integer, String, Boolean
from app.core.db import Base
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    roles = Column(String(255), default="student")  # "admin,teacher,student"
