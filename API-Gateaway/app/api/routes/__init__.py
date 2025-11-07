from fastapi import APIRouter
from . import public, secure

router = APIRouter()
router.include_router(public.router, prefix="")
router.include_router(secure.router, prefix="")
