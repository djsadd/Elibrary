from fastapi import FastAPI
from app.api.routes_files import router as files_router

app = FastAPI(title="File Storage Service")

app.include_router(files_router)

@app.get("/")
def root():
    return {"service": "File Storage", "status": "running"}
