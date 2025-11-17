from fastapi import APIRouter, Request, Depends
from app.core.config import settings
from app.services.proxy import forward
from app.services.auth_guard import auth_required

router = APIRouter(tags=["secure"])


# ======== Review ========

@router.api_route("/reviews", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@router.api_route("/reviews/", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def reviews_root_proxy(request: Request, _=Depends(auth_required)):
    return await forward(request, settings.REVIEW_SERVICE_URL, path_suffix="reviews")


@router.api_route("/reviews/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@router.api_route("/reviews/{path:path}/", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def reviews_proxy(path: str, request: Request, _=Depends(auth_required)):
    return await forward(request, settings.REVIEW_SERVICE_URL, path_suffix=f"reviews/{path}")


# =========== Favourites ==========
@router.api_route("/favourites", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@router.api_route("/favourites/", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def reviews_root_proxy(request: Request, _=Depends(auth_required)):
    return await forward(request, settings.FAVOURITES_SERVICE_URL, path_suffix="favourites")


@router.api_route("/favourites/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@router.api_route("/favourites/{path:path}/", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def reviews_proxy(path: str, request: Request, _=Depends(auth_required)):
    return await forward(request, settings.FAVOURITES_SERVICE_URL, path_suffix=f"favourites/{path}")


# ====== Catalog ======
@router.get("/catalog/books")
async def catalog_books(request: Request, _=Depends(auth_required)):
    return await forward(request, settings.CATALOG_SERVICE_URL)


@router.get("/catalog/books/{book_id}")
async def catalog_book_by_id(request: Request, book_id: str, _=Depends(auth_required)):
    return await forward(request, settings.CATALOG_SERVICE_URL)


# ====== Profile ======
@router.get("/profile/me")
async def profile_me(request: Request, _=Depends(auth_required)):
    return await forward(request, settings.PROFILE_SERVICE_URL)


# ====== File storage ======
@router.post("/files/upload")
async def upload_file(request: Request, _=Depends(auth_required)):
    return await forward(request, settings.FILE_SERVICE_URL)


# ====== Search ======
@router.get("/search")
async def search(request: Request, _=Depends(auth_required)):
    return await forward(request, settings.SEARCH_SERVICE_URL)


# ====== Notifications ======
@router.post("/notify/send")
async def notify(request: Request, _=Depends(auth_required)):
    return await forward(request, settings.NOTIFY_SERVICE_URL)
