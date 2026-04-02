# app/main.py
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api.ai import ai_router
from app.api.routes import router
from app.core.db import Base, engine
from app.utils.logging_config import setup_logging
from prometheus_fastapi_instrumentator import Instrumentator

# --- Патч на лимит multipart (обходит стандартный 1MB) ---
from starlette.formparsers import MultiPartParser

# значение в байтах
MultiPartParser.max_file_size = 50 * 1024 * 1024  # 50 MB
MultiPartParser.max_fields = 1000
MultiPartParser.max_field_size = 2 * 1024 * 1024
# --- конец патча ---

def ensure_menu_item_i18n_columns() -> None:
    inspector = inspect(engine)
    if "menu_items" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("menu_items")}
    missing_columns = [name for name in ("title_ru", "title_kk", "title_en") if name not in existing_columns]
    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name in missing_columns:
            connection.execute(text(f"ALTER TABLE menu_items ADD COLUMN {column_name} VARCHAR(255)"))

        connection.execute(
            text(
                """
                UPDATE menu_items
                SET title_ru = COALESCE(title_ru, title),
                    title_kk = COALESCE(title_kk, title),
                    title_en = COALESCE(title_en, title)
                """
            )
        )


Base.metadata.create_all(bind=engine)
ensure_menu_item_i18n_columns()

setup_logging()

app = FastAPI(title="CatalogService", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(ai_router)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.get("/health")
def health():
    return {"status": "ok", "service": "catalog"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
