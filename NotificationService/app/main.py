from fastapi import FastAPI
from app.api.routes import router as notification_router

app = FastAPI(title="Notification Service")

app.include_router(notification_router)
