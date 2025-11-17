import os
from uuid import uuid4
from datetime import datetime
from fastapi import UploadFile
from app.core.config import settings

BASE_UPLOAD_DIR = os.path.join(settings.STORAGE_PATH, "upload")


async def save_file(file: UploadFile):
    # Генерируем путь: storage/upload/YYYY/MM/
    now = datetime.now()
    year_dir = os.path.join(BASE_UPLOAD_DIR, str(now.year))
    month_dir = os.path.join(year_dir, f"{now.month:02d}")
    os.makedirs(month_dir, exist_ok=True)

    # Уникальное имя файла
    filename = f"{uuid4().hex}_{file.filename}"
    full_path = os.path.join(month_dir, filename)

    # Сохраняем файл
    with open(full_path, "wb") as f:
        f.write(await file.read())

    return {
        "filename": file.filename,
        "stored_as": filename,
        "path": full_path,
        "content_type": file.content_type,
        "size": os.path.getsize(full_path),
        "uploaded_to": f"/upload/{now.year}/{now.month:02d}/{filename}"
    }


def get_file(year: str, month: str, filename: str):
    file_path = os.path.join(BASE_UPLOAD_DIR, year, month, filename)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Файл {filename} не найден")
    return file_path
