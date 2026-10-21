from pathlib import Path
from datetime import datetime
from uuid import uuid4
import re
from fastapi import UploadFile, HTTPException
from app.core.config import settings


def upload_root() -> Path:
    return (Path(settings.STORAGE_PATH) / "upload").resolve()


async def save_file(file: UploadFile):
    now = datetime.now()
    extension = Path((file.filename or "").replace("\\", "/")).suffix.lower()
    if extension not in {s.strip() for s in settings.ALLOWED_EXTENSIONS.split(",")}:
        raise HTTPException(415, "Unsupported file extension")
    directory = upload_root() / str(now.year) / f"{now.month:02d}"
    directory.mkdir(parents=True, exist_ok=True)
    filename = uuid4().hex + extension
    path = directory / filename
    size = 0
    try:
        with path.open("xb") as out:
            while chunk := await file.read(64 * 1024):
                size += len(chunk)
                if size > settings.MAX_UPLOAD_MB * 1024 * 1024:
                    raise HTTPException(413, "File too large")
                out.write(chunk)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()
    return {"filename": filename, "stored_as": filename, "content_type": file.content_type,
            "size": size, "uploaded_to": f"/upload/{now.year}/{now.month:02d}/{filename}"}


def get_file(year: str, month: str, filename: str):
    if not re.fullmatch(r"[0-9]{4}", year) or not re.fullmatch(r"0[1-9]|1[0-2]", month):
        raise FileNotFoundError("File not found")
    if not filename or any(c in filename for c in ("/", "\\", ":")) or filename in {".", ".."}:
        raise FileNotFoundError("File not found")
    root = upload_root()
    try:
        path = (root / year / month / filename).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise FileNotFoundError("File not found")
    except (ValueError, OSError, RuntimeError) as exc:
        raise FileNotFoundError("File not found") from exc
    return str(path)
