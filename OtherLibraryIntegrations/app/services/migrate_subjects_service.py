import base64
import json
import logging
import re
from io import BytesIO

import aiohttp
import fitz
import requests
from openai import OpenAI
from PIL import Image

from app.core.config import settings
from app.core.db import SessionLocal
from app.models.libtau import LibraryWithSubjects

logger = logging.getLogger("migrate_subjects")

client = OpenAI(api_key=settings.OPENAI_API_KEY)


async def extract_cover_from_pdf(pdf_bytes: bytes, max_size_kb: int = 150) -> bytes:
    """Extract a JPEG cover from the first page of a PDF and keep it under size."""
    pdf = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = pdf.load_page(0)
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))

    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

    quality = 85
    buffer = BytesIO()
    while quality > 20:
        buffer.seek(0)
        buffer.truncate()

        img.save(buffer, format="JPEG", quality=quality)
        size_kb = buffer.tell() / 1024

        if size_kb <= max_size_kb:
            break
        quality -= 5

    return buffer.getvalue()


async def upload_file_to_raw_service(
    file_url: str | None = None,
    filename: str | None = None,
    token: str | None = None,
    data: bytes | None = None,
) -> dict:
    """Upload a file to /upload/raw, either by url or raw bytes."""
    _ = token  # Token is unused but kept for signature parity.
    if data is None:
        if not file_url:
            raise Exception("file_url or data must be provided")

        async with aiohttp.ClientSession() as session:
            async with session.get(file_url) as resp:
                if resp.status != 200:
                    raise Exception(f"Cannot download file: {resp.status}")
                data = await resp.read()

    headers = {"x-filename": filename or "file"}

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{settings.CATALOG_SERVICE_URL}/upload/raw",
            data=data,
            headers=headers,
        ) as upload_resp:
            if upload_resp.status != 200:
                text = await upload_resp.text()
                raise Exception(f"Upload failed: {text}")

            return await upload_resp.json()


def extract_json(text: str) -> str:
    """Extract the first JSON object from a string."""
    matches = re.findall(r"\{.*?\}", text, flags=re.DOTALL)
    if not matches:
        raise ValueError("JSON object not found in text")
    return matches[0]


def parse_author_title(text: str) -> dict:
    if not text:
        return {"authors": [], "title": ""}

    raw = text.strip()
    prompt = (
        "Split an author/title line into JSON.\n"
        "Return only JSON like:\n"
        '{"authors": ["Author 1"], "title": "Book title"}\n'
        "No markdown or code fences.\n"
        f"Input: {raw}"
    )

    try:
        response = client.responses.create(
            model="gpt-4.1-mini",
            input=prompt,
        )
        content = response.output[0].content[0]
        text_obj = getattr(content, "text", content)
        result_text = getattr(text_obj, "value", str(text_obj)).strip()

        cleaned = extract_json(result_text)
        data = json.loads(cleaned)

        authors = data.get("authors") or []
        title = data.get("title") or raw

        if not isinstance(authors, list):
            authors = [str(authors)]

        authors = [str(a).strip() for a in authors if str(a).strip()]
        return {"authors": authors, "title": title}

    except Exception as exc:
        logger.exception("parse_author_title failed: %s", exc)
        return {"authors": [], "title": raw}


async def run_subjects_migration(pending_items: list[dict], token: str) -> dict:
    if not pending_items:
        return {"status": "no_pending", "message": "No pending items to migrate."}

    db = SessionLocal()
    try:
        migrated = 0
        errors: list[dict] = []
        created_items: list[dict] = []

        headers = {"Authorization": f"Bearer {token}"}

        grouped_items: dict[str, list[dict]] = {}
        for item in pending_items:
            key = item.get("pdf_id") or item.get("download_url") or str(item["id"])
            grouped_items.setdefault(key, []).append(item)

        logger.info(
            "commit_subjects_migration: grouped_items=%d (by pdf_id/download_url)",
            len(grouped_items),
        )

        for group_key, items in grouped_items.items():
            if migrated >= 2000:
                logger.debug("commit_subjects_migration: batch limit reached (2000)")
                break

            main_item = items[0]
            row = db.get(LibraryWithSubjects, main_item["id"])
            if not row or row.is_integrated:
                logger.debug(
                    "commit_subjects_migration: skip id=%s exists=%s integrated=%s",
                    main_item["id"],
                    bool(row),
                    bool(row and row.is_integrated),
                )
                continue

            subjects_set = set()
            for gi in items:
                gi_row = db.get(LibraryWithSubjects, gi["id"])
                if not gi_row or not gi_row.path_titles:
                    continue
                for subject in gi_row.path_titles.split("/")[:-1]:
                    subject = subject.strip()
                    if subject:
                        subjects_set.add(subject)

            subjects_list = sorted(subjects_set) if subjects_set else []

            parsed = parse_author_title(row.post_title)
            authors_list = parsed["authors"]
            book_title = parsed["title"]

            language = None
            if subjects_list:
                first = subjects_list[0].lower()
                if first in ["english"]:
                    language = "English"
                elif first in ["russian"]:
                    language = "Russian"
                elif first in ["kazakh"]:
                    language = "Kazakh"

            try:
                upload_result = await upload_file_to_raw_service(
                    row.pdf_url,
                    f"{book_title}.pdf",
                    token,
                )
                file_id = upload_result["file"]["file_id"]
                download_url = upload_result["file"]["download_url"]

                async with aiohttp.ClientSession() as session:
                    async with session.get(row.pdf_url) as resp:
                        pdf_bytes = await resp.read()

                cover_bytes = await extract_cover_from_pdf(pdf_bytes)
                cover_base64 = (
                    "data:image/jpeg;base64," + base64.b64encode(cover_bytes).decode()
                )
            except Exception as exc:
                errors.append({"id": row.id, "error": f"Upload failed: {exc}"})
                logger.exception(
                    "commit_subjects_migration: upload/cover failed id=%s error=%s",
                    row.id,
                    exc,
                )
                continue

            payload = {
                "title": book_title,
                "authors": authors_list,
                "subjects": subjects_list,
                "summary": None,
                "year": None,
                "lang": language,
                "cover": cover_base64,
                "file_id": file_id,
                "pub_info": None,
                "download_url": download_url,
                "formats": ["EBOOK", "HARDCOPY"],
                "isbn": None,
                "edition": None,
                "page_count": None,
                "available_copies": 1,
                "is_public": True,
                "source": "LIBRARY",
            }

            try:
                resp = requests.post(
                    f"{settings.CATALOG_SERVICE_URL}/books",
                    json=payload,
                    headers=headers,
                    timeout=500,
                )
                if not (200 <= resp.status_code < 300):
                    errors.append({"id": row.id, "error": resp.text})
                    logger.error(
                        "commit_subjects_migration: catalog error id=%s status=%s body=%s",
                        row.id,
                        resp.status_code,
                        resp.text,
                    )
                    continue

                created = resp.json()
                for gi in items:
                    gi_row = db.get(LibraryWithSubjects, gi["id"])
                    if not gi_row:
                        continue
                    if hasattr(gi_row, "book_id"):
                        gi_row.book_id = created.get("id")
                    gi_row.is_integrated = True
                    gi_row.file_is_downloaded = True

                created_items.append(
                    {
                        "catalog_book_id": created.get("id"),
                        "library_ids": [gi["id"] for gi in items],
                        "title": book_title,
                        "pdf_id": row.pdf_id,
                        "download_url": download_url,
                        "subjects": subjects_list,
                        "authors": authors_list,
                    }
                )
                migrated += 1

            except Exception as exc:
                errors.append({"id": row.id, "error": str(exc)})
                logger.exception(
                    "commit_subjects_migration: request failed id=%s error=%s",
                    row.id,
                    exc,
                )

        db.commit()

        return {
            "status": "completed",
            "migrated": migrated,
            "errors": errors,
            "items": created_items,
        }
    finally:
        db.close()
