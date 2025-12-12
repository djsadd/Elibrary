# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.db import Base, engine
from app.api.routes import router
import uvicorn

# --- Патч на лимит multipart (обходит стандартный 1MB) ---
from starlette.formparsers import MultiPartParser

# значение в байтах
MultiPartParser.max_file_size = 50 * 1024 * 1024  # 50 MB
MultiPartParser.max_fields = 1000
MultiPartParser.max_field_size = 2 * 1024 * 1024
# --- конец патча ---

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CatalogService", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "catalog"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
