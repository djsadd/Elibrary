# app/models/user.py
from sqlalchemy import Column, Integer, String, Boolean, func, DateTime
from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Контакты
    phone = Column(String(50), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)

    # Роль и доступ
    role = Column(String(50), default="student")  # admin, teacher, librarian, student
    permissions = Column(String, nullable=True)  # JSON string if needed

    # Учебные данные
    institution = Column(String(255), nullable=True)
    faculty = Column(String(255), nullable=True)
    group_name = Column(String(255), nullable=True)
    student_id = Column(String(255), nullable=True)

    # Активность
    last_login_at = Column(DateTime)
    last_activity_at = Column(DateTime)
    reading_history_count = Column(Integer, default=0)

    # Подписка
    subscription_type = Column(String(50), default="free")
    subscription_expire_at = Column(DateTime, nullable=True)

    # OAuth
    google_id = Column(String(255), nullable=True)
    github_id = Column(String(255), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
