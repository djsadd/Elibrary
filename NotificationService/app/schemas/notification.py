from pydantic import BaseModel, Field
from typing import Literal

class NotificationCreate(BaseModel):
    user_id: int | None = None
    type: Literal["email", "sms", "push"]
    message: str = Field(min_length=1, max_length=10000)

    class Config:
        from_attributes = True

class NotificationOut(BaseModel):
    id: int
    status: str

    class Config:
        from_attributes = True
