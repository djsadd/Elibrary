from fastapi import APIRouter, Request
from app.core.config import settings
from app.services.proxy import forward

router = APIRouter(tags=["public"])


@router.api_route("/auth", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def auth_root(request: Request):
    return await forward(request, settings.AUTH_SERVICE_URL, path_suffix="auth")


@router.api_route("/auth/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def auth_proxy(path: str, request: Request):
    return await forward(request, settings.AUTH_SERVICE_URL, path_suffix=f"auth/{path}")


@router.api_route("/catalog", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def catalog_root(request: Request):
    return await forward(request, settings.CATALOG_SERVICE_URL, path_suffix="catalog")


@router.api_route("/catalog/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def catalog_proxy(path: str, request: Request):
    return await forward(request, settings.CATALOG_SERVICE_URL, path_suffix=f"catalog/{path}")
