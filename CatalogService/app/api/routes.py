from fastapi import APIRouter

from app.api import (
    catalog_admin,
    catalog_ai,
    catalog_authors,
    catalog_books,
    catalog_filters,
    catalog_files,
    catalog_notes,
    catalog_playlists,
    catalog_subjects,
    catalog_userbooks,
)

router = APIRouter(prefix="/catalog", tags=["catalog"])

router.include_router(catalog_files.router)
router.include_router(catalog_filters.router)
router.include_router(catalog_books.router)
router.include_router(catalog_authors.router)
router.include_router(catalog_subjects.router)
router.include_router(catalog_playlists.router)
router.include_router(catalog_userbooks.router)
router.include_router(catalog_notes.router)
router.include_router(catalog_admin.router)
router.include_router(catalog_ai.router)