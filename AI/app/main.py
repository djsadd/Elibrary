from fastapi import FastAPI
from app.routers.external import router as external_router

app = FastAPI()

app.include_router(external_router, prefix="/api")

@app.get("/")
def root():
    return {"status": "ok"}
