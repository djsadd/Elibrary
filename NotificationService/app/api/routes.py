from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.schemas.notification import NotificationCreate, NotificationOut
from app.models.notification import Notification
from app.tasks import send_notification_task
from app.utils.authz import get_current_user

router = APIRouter(prefix="/")


@router.post("/", response_model=NotificationOut)
async def create_notification(data: NotificationCreate, db: Session = Depends(get_db),
                              current_user: dict = Depends(get_current_user)):
    notif = Notification(user_id=current_user["id"], type=data.type, message=data.message)
    db.add(notif)
    db.commit()
    db.refresh(notif)

    send_notification_task.delay(notif.id)  # Отправка асинхронно через Celery

    return {"id": notif.id, "status": "pending"}


@router.get("/", response_model=list[NotificationOut])
def get_user_notifications(db: Session = Depends(get_db),
                           current_user: dict = Depends(get_current_user)):
    notifs = db.query(Notification).filter(Notification.user_id == current_user["id"]).all()
    return notifs


@router.get("/{notif_id}", response_model=NotificationOut)
def get_notification(notif_id: int, db: Session = Depends(get_db),
                     current_user: dict = Depends(get_current_user)):
    notif = db.query(Notification).filter(Notification.id == notif_id,
                                          Notification.user_id == current_user["id"]).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notif
