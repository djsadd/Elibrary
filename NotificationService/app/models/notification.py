from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from app.core.db import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    type = Column(String, nullable=False)  # email | sms | push
    message = Column(String, nullable=False)
    status = Column(String, default="pending")
    created_at = Column(DateTime, server_default=func.now())
