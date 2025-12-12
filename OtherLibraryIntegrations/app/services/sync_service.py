import time
from sqlalchemy import select
from app.core.db import SessionLocal
from app.models.libtau import Library, LibraryWithSubjects


class LibrarySyncService:
    def __init__(self, external_service):
        self.external_service = external_service

    def sync_library_books(self):
        pdf_list = self.external_service.fetch_books()
        added = skipped = 0
        processed_books = []

        with SessionLocal() as session:
            for row in pdf_list:
                pdf_id = str(row.get("pdf_id"))
                title = row.get("post_title")
                pdf_url = row.get("pdf_url")

                # �?�?�?�?��?�?��?, ��?�'�? �>�� �?��� ��?��?�� �? �+������
                stmt = select(Library).where(Library.pdf_id == pdf_id)
                existing = session.execute(stmt).scalar_one_or_none()

                if existing:
                    skipped += 1
                else:
                    # �"�?�+���?�>�?��? �?�?�?�?�? ��?��?�?
                    new_book = Library(
                        title=title,
                        pdf_id=pdf_id,
                        download_url=pdf_url,
                        book_id=None,
                        file_is_indexed=False,
                        title_is_indexed=False,
                        is_integrated=False,
                        timestamp=time.time()
                    )
                    session.add(new_book)
                    added += 1

                processed_books.append({
                    "pdf_id": pdf_id,
                    "title": title,
                    "download_url": pdf_url,
                    "book_id": None,
                    "file_is_indexed": False,
                    "title_is_indexed": False,
                    "is_integrated": False,
                    "status": "skipped" if existing else "added",
                    "timestamp": time.time()
                })

            session.commit()

        return {
            "total": len(pdf_list),
            "added": added,
            "skipped": skipped,
            "books": processed_books
        }


class LibrarySyncServiceSubjects:
    def __init__(self, external_service):
        self.external_service = external_service

    def sync_library_books(self, apply_changes: bool = False, rows_override=None):
        """
        Синхронизирует ответы сервиса /crawl_pdfs с таблицей LibraryWithSubjects.
        """
        pdf_list = rows_override if rows_override is not None else self.external_service.fetch_books()
        added = updated = skipped_no_pdf_id_count = skipped_duplicates = 0
        processed_books = []
        seen_pdf_ids = set()

        with SessionLocal() as session:
            for row in pdf_list:
                raw_pdf_id = row.get("pdf_id")
                pdf_id = str(raw_pdf_id) if raw_pdf_id is not None else None
                if not pdf_id:
                    processed_books.append(
                        {
                            **row,
                            "status": "skipped_no_pdf_id",
                            "timestamp": time.time(),
                        }
                    )
                    skipped_no_pdf_id_count += 1
                    continue

                if pdf_id in seen_pdf_ids:
                    processed_books.append(
                        {**row, "status": "skipped_duplicate_batch", "timestamp": time.time()}
                    )
                    skipped_duplicates += 1
                    continue
                seen_pdf_ids.add(pdf_id)

                stmt = select(LibraryWithSubjects).where(LibraryWithSubjects.pdf_id == pdf_id)
                existing = session.execute(stmt).scalar_one_or_none()

                if existing:
                    status = "pending_update"
                    if apply_changes:
                        existing.post_id = row.get("post_id")
                        existing.post_title = row.get("post_title")
                        existing.level = row.get("level")
                        existing.path_ids = row.get("path_ids")
                        existing.path_titles = row.get("path_titles")
                        existing.pdf_url = row.get("pdf_url")
                        existing.timestamp = time.time()
                        status = "updated"
                        updated += 1
                    else:
                        updated += 1
                else:
                    status = "pending_add"
                    if apply_changes:
                        new_book = LibraryWithSubjects(
                            post_id=row.get("post_id"),
                            post_title=row.get("post_title"),
                            level=row.get("level"),
                            path_ids=row.get("path_ids"),
                            path_titles=row.get("path_titles"),
                            pdf_id=pdf_id,
                            pdf_url=row.get("pdf_url"),
                            file_is_indexed=False,
                            title_is_indexed=False,
                            is_integrated=False,
                            timestamp=time.time()
                        )
                        session.add(new_book)
                        status = "added"
                        added += 1
                    else:
                        added += 1

                processed_books.append(
                    {
                        **row,
                        "status": status,
                        "timestamp": time.time(),
                    }
                )

            if apply_changes:
                session.commit()

        return {
            "total": len(pdf_list),
            "added": added,
            "updated": updated,
            "skipped_no_pdf_id": skipped_no_pdf_id_count,
            "skipped_duplicates": skipped_duplicates,
            "books": processed_books,
            "applied": apply_changes,
        }
