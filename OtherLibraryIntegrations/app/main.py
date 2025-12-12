from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(title="Library Integration Microservice")

app.include_router(router)
