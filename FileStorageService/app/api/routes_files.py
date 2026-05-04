import mimetypes

from fastapi import APIRouter, UploadFile, HTTPException
from fastapi.responses import FileResponse
from app.services.file_service import save_file, get_file

router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/upload")
async def upload_file(file: UploadFile):
    try:
        meta = await save_file(file)
        return {"status": "ok", "file": meta}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/upload/{year}/{month}/{filename}")
async def download_file(year: str, month: str, filename: str):
    try:
        path = get_file(year, month, filename)
        media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        return FileResponse(path, media_type=media_type)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
