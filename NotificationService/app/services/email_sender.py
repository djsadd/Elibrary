import smtplib

class EmailSender:

    @staticmethod
    async def send(notification):
        # тупо для примера
        print("Sending EMAIL:", notification.message)
        return True
