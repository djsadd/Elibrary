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


def ensure_content_page_html_column() -> None:
    inspector = inspect(engine)
    if "content_pages" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("content_pages")}
    if "content_html" in existing_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE content_pages ADD COLUMN content_html TEXT"))


def ensure_content_page_i18n_columns() -> None:
    inspector = inspect(engine)
    if "content_pages" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("content_pages")}
    expected_columns = {
        "title_ru": "VARCHAR(255)",
        "title_kk": "VARCHAR(255)",
        "title_en": "VARCHAR(255)",
        "menu_title_ru": "VARCHAR(255)",
        "menu_title_kk": "VARCHAR(255)",
        "menu_title_en": "VARCHAR(255)",
        "summary_ru": "TEXT",
        "summary_kk": "TEXT",
        "summary_en": "TEXT",
        "content_html_ru": "TEXT",
        "content_html_kk": "TEXT",
        "content_html_en": "TEXT",
    }
    missing_columns = {name: kind for name, kind in expected_columns.items() if name not in existing_columns}
    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns.items():
            connection.execute(text(f"ALTER TABLE content_pages ADD COLUMN {column_name} {column_type}"))

        connection.execute(
            text(
                """
                UPDATE content_pages
                SET title_ru = COALESCE(title_ru, title),
                    title_kk = COALESCE(title_kk, title),
                    title_en = COALESCE(title_en, title),
                    menu_title_ru = COALESCE(menu_title_ru, menu_title, title),
                    menu_title_kk = COALESCE(menu_title_kk, menu_title, title),
                    menu_title_en = COALESCE(menu_title_en, menu_title, title),
                    summary_ru = COALESCE(summary_ru, summary),
                    summary_kk = COALESCE(summary_kk, summary),
                    summary_en = COALESCE(summary_en, summary),
                    content_html_ru = COALESCE(content_html_ru, content_html),
                    content_html_kk = COALESCE(content_html_kk, content_html),
                    content_html_en = COALESCE(content_html_en, content_html)
                """
            )
        )


Base.metadata.create_all(bind=engine)
ensure_menu_item_i18n_columns()
ensure_content_page_html_column()
ensure_content_page_i18n_columns()

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
