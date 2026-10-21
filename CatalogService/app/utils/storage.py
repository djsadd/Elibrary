import os
from pathlib import Path, PurePosixPath
from fastapi import HTTPException


def media_root() -> Path:
    return Path(os.getenv("MEDIA_ROOT", os.getenv("STORAGE_PATH", "storage"))).resolve()


def validate_file_id(value: str | None) -> str | None:
    if value is None:
        return value
    if not value or len(value) > 1024 or any(ord(c) < 32 for c in value):
        raise ValueError("Invalid file identifier")
    if any(c in value for c in ("\\", ":", "?", "#", "%")) or value.startswith("/"):
        raise ValueError("Invalid file identifier")
    parts = value.split("/")
    if any(p in {"", ".", ".."} or p.endswith((".", " ")) for p in parts):
        raise ValueError("Invalid file identifier")
    return value


def resolve_file(file_id: str | None) -> Path:
    try:
        validate_file_id(file_id)
        if not file_id:
            raise ValueError("Missing file identifier")
        root = media_root()
        path = (root / file_id).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError("File not found")
        return path
    except (ValueError, OSError, RuntimeError) as exc:
        raise HTTPException(404, "File not found") from exc
