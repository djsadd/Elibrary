from app.services.email_sender import EmailSender


class NotificationSender:

    @staticmethod
    async def send(notification):
        if notification.type == "email":
            return await EmailSender.send(notification)


