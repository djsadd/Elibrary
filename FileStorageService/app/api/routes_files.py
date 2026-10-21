import mimetypes

from fastapi import APIRouter, UploadFile, HTTPException, Depends
from fastapi.responses import FileResponse
from app.utils.authz import require_roles, get_current_user
from app.services.file_service import save_file, get_file

router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/upload", dependencies=[Depends(require_roles("editor", "admin", "librarian"))])
async def upload_file(file: UploadFile):
    try:
        meta = await save_file(file)
        return {"status": "ok", "file": meta}
    except HTTPException:
        raise
    except OSError as exc:
        raise HTTPException(status_code=500, detail="File operation failed") from exc


@router.get("/upload/{year}/{month}/{filename}", dependencies=[Depends(require_roles("editor", "admin", "librarian"))])
async def download_file(year: str, month: str, filename: str):
    try:
        path = get_file(year, month, filename)
        media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        return FileResponse(path, media_type=media_type)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail="File not found")
