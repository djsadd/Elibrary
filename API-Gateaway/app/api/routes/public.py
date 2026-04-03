from fastapi import APIRouter, Request, Depends
from app.schemas.public_analytics import PublicPageViewIn
from app.services.public_analytics import track_public_page_view
from app.core.config import settings
from app.services.proxy import forward
from app.services.auth_guard import auth_optional

router = APIRouter(tags=["public"])


@router.api_route("/auth", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def auth_root(request: Request, _=Depends(auth_optional)):
    return await forward(request, settings.AUTH_SERVICE_URL, path_suffix="auth")


@router.api_route("/auth/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def auth_proxy(path: str, request: Request, _=Depends(auth_optional)):
    return await forward(request, settings.AUTH_SERVICE_URL, path_suffix=f"auth/{path}")


@router.api_route("/catalog", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def catalog_root(request: Request, _=Depends(auth_optional)):
    return await forward(request, settings.CATALOG_SERVICE_URL, path_suffix="catalog")


@router.api_route("/catalog/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def catalog_proxy(path: str, request: Request, _=Depends(auth_optional)):
    return await forward(request, settings.CATALOG_SERVICE_URL, path_suffix=f"catalog/{path}")


@router.get("/files/upload/{path:path}")
async def files_upload_proxy(path: str, request: Request, _=Depends(auth_optional)):
    return await forward(request, settings.FILE_SERVICE_URL, path_suffix=f"files/upload/{path}")


@router.post("/public/track")
async def public_track_page_view(payload: PublicPageViewIn, request: Request, _=Depends(auth_optional)):
    return await track_public_page_view(request, payload)

