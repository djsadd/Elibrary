from app.celeryconfig import celery
from app.services.sender import NotificationSender
from app.core.db import SessionLocal
from app.models.notification import Notification

@celery.task
def send_notification_task(notification_id: int):
    db = SessionLocal()
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        try:
            import asyncio
            asyncio.run(NotificationSender.send(notif))
            notif.status = "sent"
        except Exception as e:
            notif.status = "failed"
        finally:
            db.commit()
            db.close()
