from pydantic import BaseModel

class NotificationCreate(BaseModel):
    user_id: int
    type: str
    message: str

class NotificationOut(BaseModel):
    id: int
    status: str

    class Config:
        orm_mode = True
