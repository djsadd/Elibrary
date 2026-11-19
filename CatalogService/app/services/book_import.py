"""Импорт книг из Excel (+ необязательный источник файлов: ZIP-архив или папка на сервере).

Формат Excel (первая строка — заголовки, порядок колонок не важен):
    №  |  Название  |  Автор  |  Жанры через запятую  |  Язык  |  Ссылка  |  Файл

* «№» — идентификатор строки; файл книги ищется по имени «<№>.pdf»
  (также принимаются .epub / .djvu, папки игнорируются, ведущие нули не важны: 7 = 007).
* «Файл» (необязательно) — явное имя файла книги («Алгебра 9 класс.pdf») или путь
  относительно корня архива/папки («Математика/Алгебра 9 класс.pdf»). Если колонка
  заполнена, файл ищется по ней, а не по «№».
* «Автор» — несколько авторов разделяются точкой с запятой («;»), т.к. запятая
  встречается внутри ФИО («Иванов, И. И.»).
* «Жанры» — через запятую (или точку с запятой).
* «Ссылка» — ссылка на книгу на внешнем сайте. Если файла нет, а ссылка
  есть — книга создаётся как «внешняя» (source = EXTERNAL).
"""
from __future__ import annotations

import os
import re
import uuid
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import BinaryIO, Callable, Optional

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from app.api.catalog_common import _ensure_authors, _ensure_subjects
from app.models.book import Author, Book, BookSource, book_authors
from app.schemas.book import validate_external_url

MAX_ROWS = int(os.getenv("CATALOG_IMPORT_MAX_ROWS", "5000"))
MAX_BOOK_FILE_SIZE = int(os.getenv("CATALOG_IMPORT_MAX_FILE_MB", "100")) * 1024 * 1024
MAX_ZIP_TOTAL_SIZE = int(os.getenv("CATALOG_IMPORT_MAX_ZIP_TOTAL_MB", "2048")) * 1024 * 1024
BOOK_EXTENSIONS = (".pdf", ".epub", ".djvu")  # в порядке приоритета

# Возможные варианты заголовков (сравнение без регистра, лишних пробелов и знаков).
COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "num": ("№", "no", "n", "номер", "id", "#", "№ п/п", "п/п"),
    "title": ("название", "наименование", "заглавие", "title", "атауы"),
    "authors": ("автор", "авторы", "author", "authors", "авторы через запятую"),
    "subjects": ("жанры через запятую", "жанры", "жанр", "категории", "genres", "genre", "subjects"),
    "lang": ("язык", "lang", "language", "тілі"),
    "link": ("ссылка", "link", "url", "сілтеме", "внешняя ссылка"),
    "file": ("файл", "имя файла", "путь", "путь к файлу", "file", "filename", "file name", "path"),
}
COLUMN_ORDER = ("num", "title", "authors", "subjects", "lang", "link", "file")


def _norm_header(value) -> str:
    s = str(value or "").strip().lower().replace("ё", "е")
    return re.sub(r"\s+", " ", s).strip(" .:")


def _cell_str(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip()


def _split(value: str, pattern: str) -> list[str]:
    seen: list[str] = []
    for part in re.split(pattern, value or ""):
        part = re.sub(r"\s+", " ", part).strip()
        if part and part.lower() not in {p.lower() for p in seen}:
            seen.append(part)
    return seen


def _num_key(value: str) -> str:
    """Ключ для сопоставления «№» с именем файла: без регистра, «007» == «7»."""
    key = (value or "").strip().lower()
    return str(int(key)) if key.isdigit() else key


def _path_key(value: str) -> str:
    return str(PurePosixPath((value or "").strip().replace("\\", "/").strip("/"))).lower()


@dataclass
class ImportRowResult:
    row: int
    num: str
    title: str
    status: str  # created | skipped | error
    message: str = ""
    book_id: Optional[int] = None
    kind: Optional[str] = None  # file | external


@dataclass
class ImportReport:
    dry_run: bool
    total_rows: int = 0
    created: int = 0
    skipped: int = 0
    errors: int = 0
    with_file: int = 0
    external: int = 0
    unused_files: list[str] = field(default_factory=list)
    rows: list[ImportRowResult] = field(default_factory=list)
    created_book_ids: list[int] = field(default_factory=list)

    def add(self, r: ImportRowResult) -> None:
        self.rows.append(r)
        if r.status == "created":
            self.created += 1
            if r.kind == "file":
                self.with_file += 1
            elif r.kind == "external":
                self.external += 1
        elif r.status == "skipped":
            self.skipped += 1
        else:
            self.errors += 1


class ImportFormatError(ValueError):
    pass


# ---------- Excel ----------

def _detect_columns(rows: list[tuple]) -> tuple[int, dict[str, int]]:
    """Возвращает (индекс строки заголовка, {поле: индекс колонки})."""
    for idx, row in enumerate(rows[:10]):
        mapping: dict[str, int] = {}
        for col, value in enumerate(row):
            h = _norm_header(value)
            if not h:
                continue
            for key, aliases in COLUMN_ALIASES.items():
                if key not in mapping and (h in aliases or any(h.startswith(a) for a in aliases if len(a) > 3)):
                    mapping[key] = col
                    break
        if "title" in mapping:
            return idx, mapping
    # Заголовков не нашли — считаем, что колонки идут в стандартном порядке без заголовка
    return -1, {key: i for i, key in enumerate(COLUMN_ORDER)}


def read_excel(fp: BinaryIO, max_rows: int = MAX_ROWS) -> list[tuple[int, dict[str, str]]]:
    try:
        wb = load_workbook(fp, read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001 — openpyxl бросает разные исключения
        raise ImportFormatError("Не удалось прочитать Excel. Нужен файл .xlsx") from exc
    try:
        ws = wb.worksheets[0]
        raw = []
        for row in ws.iter_rows(values_only=True):
            raw.append(row)
            if len(raw) > max_rows + 10:
                raise ImportFormatError(f"Слишком много строк (максимум {max_rows})")
    finally:
        wb.close()

    header_idx, mapping = _detect_columns(raw)
    missing = [k for k in ("title",) if k not in mapping]
    if missing:
        raise ImportFormatError("Не найдена колонка «Название»")

    out: list[tuple[int, dict[str, str]]] = []
    for i, row in enumerate(raw[header_idx + 1:], start=header_idx + 2):  # номер строки как в Excel
        values = {key: _cell_str(row[col]) if col < len(row) else "" for key, col in mapping.items()}
        if not any(values.values()):
            continue
        out.append((i, values))
    return out


# ---------- Источники файлов (ZIP / папка) ----------

@dataclass
class SourceFile:
    path: str  # относительный путь (posix) внутри архива/папки — для отчёта и поиска
    size: int
    opener: Callable[[], BinaryIO]

    @property
    def name(self) -> str:
        return PurePosixPath(self.path).name

    @property
    def ext(self) -> str:
        return os.path.splitext(self.path)[1].lower()


@dataclass
class FileIndex:
    by_num: dict[str, SourceFile] = field(default_factory=dict)   # «7» -> 7.pdf (лучшее расширение)
    by_path: dict[str, SourceFile] = field(default_factory=dict)  # «папка/книга.pdf» -> файл
    by_name: dict[str, SourceFile] = field(default_factory=dict)  # «книга.pdf» -> файл (если имя уникально)
    ambiguous_names: set[str] = field(default_factory=set)

    def add(self, f: SourceFile) -> None:
        self.by_path[_path_key(f.path)] = f
        name = f.name.lower()
        if name in self.by_name or name in self.ambiguous_names:
            self.by_name.pop(name, None)
            self.ambiguous_names.add(name)
        else:
            self.by_name[name] = f
        key = _num_key(os.path.splitext(f.name)[0])
        prev = self.by_num.get(key)
        if prev is None or BOOK_EXTENSIONS.index(f.ext) < BOOK_EXTENSIONS.index(prev.ext):
            self.by_num[key] = f

    def find_by_ref(self, ref: str) -> tuple[Optional[SourceFile], str]:
        key = _path_key(ref)
        f = self.by_path.get(key) or self.by_name.get(PurePosixPath(key).name)
        if f is not None:
            return f, ""
        if PurePosixPath(key).name in self.ambiguous_names:
            return None, f"файлов «{PurePosixPath(key).name}» несколько в разных папках — укажите путь с папкой"
        return None, f"файл «{ref}» не найден"

    def all_files(self) -> list[SourceFile]:
        return list(self.by_path.values())


def _is_book_name(path: str) -> bool:
    name = PurePosixPath(path).name
    if name.startswith((".", "~$")) or "__MACOSX" in path:
        return False
    return os.path.splitext(name)[1].lower() in BOOK_EXTENSIONS


def index_zip(zf: zipfile.ZipFile) -> FileIndex:
    total = 0
    idx = FileIndex()
    for info in zf.infolist():
        if info.is_dir():
            continue
        path = info.filename.replace("\\", "/")
        if not _is_book_name(path):
            continue
        total += info.file_size
        if total > MAX_ZIP_TOTAL_SIZE:
            raise ImportFormatError("Архив слишком большой после распаковки")
        idx.add(SourceFile(path=path, size=info.file_size, opener=lambda info=info: zf.open(info)))
    return idx


def index_dir(root: Path) -> FileIndex:
    """Рекурсивно индексирует книги в папке (симлинки за пределы папки игнорируются)."""
    root = root.resolve()
    if not root.is_dir():
        raise ImportFormatError(f"Папка не найдена: {root}")
    idx = FileIndex()
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(root).as_posix()
        if not _is_book_name(rel):
            continue
        if not p.resolve().is_relative_to(root):
            continue
        idx.add(SourceFile(path=rel, size=p.stat().st_size, opener=lambda p=p: p.open("rb")))
    return idx


def _copy_book_file(src_file: SourceFile, media_root: Path, max_size: int) -> str:
    if src_file.size > max_size:
        raise ValueError(f"файл {src_file.name} больше {max_size // (1024 * 1024)} МБ")
    file_id = f"{uuid.uuid4().hex}{src_file.ext}"
    dest = media_root / file_id
    written = 0
    try:
        with src_file.opener() as src, dest.open("xb") as out:
            head = src.read(1024)
            if src_file.ext == ".pdf" and b"%PDF" not in head:
                raise ValueError(f"{src_file.name} не является PDF")
            out.write(head)
            written = len(head)
            while chunk := src.read(1024 * 1024):
                written += len(chunk)
                if written > max_size:  # защита от поддельного размера в заголовке ZIP
                    raise ValueError(f"файл {src_file.name} слишком большой")
                out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    return file_id


# ---------- Импорт ----------

def _dup_key(title: str, authors) -> tuple:
    # casefold в Python: SQLite lower() не умеет кириллицу
    return (title.casefold(), tuple(sorted(a.casefold() for a in authors)))


def _existing_books_index(db: Session) -> dict[tuple, int]:
    authors_by_book: dict[int, list[str]] = {}
    for book_id, name in db.query(book_authors.c.book_id, Author.name).join(
        Author, Author.id == book_authors.c.author_id
    ):
        authors_by_book.setdefault(book_id, []).append(name)
    return {
        _dup_key(title or "", authors_by_book.get(book_id, [])): book_id
        for book_id, title in db.query(Book.id, Book.title)
    }


def import_books(
    db: Session,
    excel_fp: BinaryIO,
    zip_path: Optional[Path],
    media_root: Path,
    *,
    files_dir: Optional[Path] = None,
    dry_run: bool = False,
    is_public: bool = True,
    skip_duplicates: bool = True,
    max_rows: int = MAX_ROWS,
    max_file_size: int = MAX_BOOK_FILE_SIZE,
    commit_every: int = 0,
    on_row: Optional[Callable[[ImportRowResult, int, int], None]] = None,
) -> ImportReport:
    """Импортирует книги. Файлы берутся из ZIP (zip_path) или папки (files_dir).

    commit_every > 0 — коммитить каждые N созданных книг (для больших импортов: при падении
    уже созданные книги останутся, а повторный запуск пропустит их как дубликаты).
    """
    rows = read_excel(excel_fp, max_rows=max_rows)
    report = ImportReport(dry_run=dry_run, total_rows=len(rows))

    zf: Optional[zipfile.ZipFile] = None
    files = FileIndex()
    has_source = zip_path is not None or files_dir is not None
    if zip_path is not None:
        try:
            zf = zipfile.ZipFile(zip_path)
        except zipfile.BadZipFile as exc:
            raise ImportFormatError("Архив повреждён или это не ZIP") from exc
        files = index_zip(zf)
    elif files_dir is not None:
        files = index_dir(files_dir)

    used_files: set[str] = set()
    seen_nums: set[str] = set()
    existing = _existing_books_index(db) if skip_duplicates else {}

    def _done(res: ImportRowResult) -> None:
        report.add(res)
        if on_row is not None:
            on_row(res, len(report.rows), len(rows))

    try:
        for row_no, v in rows:
            num = v.get("num", "")
            title = re.sub(r"\s+", " ", v.get("title", "")).strip()
            res = ImportRowResult(row=row_no, num=num, title=title, status="error")

            if not title:
                res.message = "пустое название"
                _done(res)
                continue
            if len(title) > 512:
                res.message = "название длиннее 512 символов"
                _done(res)
                continue
            if num and _num_key(num) in seen_nums:
                res.message = f"№ {num} повторяется в таблице"
                _done(res)
                continue
            if num:
                seen_nums.add(_num_key(num))

            authors = _split(v.get("authors", ""), r"[;\n]")
            subjects = _split(v.get("subjects", ""), r"[,;\n]")
            lang = (v.get("lang") or "").strip()[:16] or None
            if any(len(x) > 256 for x in authors + subjects):
                res.message = "имя автора или жанра длиннее 256 символов"
                _done(res)
                continue

            link = v.get("link", "")
            try:
                link = validate_external_url(link)
            except ValueError:
                res.message = f"некорректная ссылка: {link[:100]}"
                _done(res)
                continue

            file_ref = v.get("file", "")
            info: Optional[SourceFile] = None
            if file_ref:
                if not has_source:
                    res.message = "указан файл, но архив/папка с файлами не переданы"
                    _done(res)
                    continue
                info, err = files.find_by_ref(file_ref)
                if info is None:
                    res.message = err
                    _done(res)
                    continue
                if info.path in used_files:
                    res.message = f"файл «{info.path}» уже привязан к другой строке"
                    _done(res)
                    continue
            elif num:
                info = files.by_num.get(_num_key(num))

            if info is None and not link:
                res.message = (
                    f"нет файла {num}.pdf и нет ссылки" if has_source else "нет ссылки (архив с файлами не загружен)"
                )
                _done(res)
                continue

            key = _dup_key(title, authors)
            if skip_duplicates:
                dup_id = existing.get(key)
                if dup_id is not None:
                    res.status = "skipped"
                    res.book_id = dup_id or None
                    res.message = "такая книга уже есть в каталоге" if dup_id else "дубликат строки выше"
                    if info is not None:
                        used_files.add(info.path)
                    _done(res)
                    continue

            res.kind = "file" if info is not None else "external"
            if dry_run:
                res.status = "created"
                res.message = "будет создана" + (f" (файл {info.path})" if info else " (внешняя ссылка)")
                if info is not None:
                    used_files.add(info.path)
                existing.setdefault(key, 0)
                _done(res)
                continue

            file_id = None
            try:
                if info is not None:
                    file_id = _copy_book_file(info, media_root, max_file_size)
                    used_files.add(info.path)
                with db.begin_nested():
                    book = Book(
                        title=title,
                        lang=lang,
                        file_id=file_id,
                        download_url=f"/api/catalog/files/{file_id}" if file_id else None,
                        external_url=link,
                        source=BookSource.LIBRARY if file_id else BookSource.EXTERNAL,
                        is_public=is_public,
                        available_copies=1 if file_id else 0,
                    )
                    book.formats_list = ["EBOOK"]
                    book.authors = _ensure_authors(db, authors)
                    book.subjects = _ensure_subjects(db, subjects)
                    db.add(book)
                    db.flush()
                res.status = "created"
                res.book_id = book.id
                res.message = "создана" + (" с файлом" if file_id else " как внешняя")
                report.created_book_ids.append(book.id)
                existing.setdefault(key, book.id)
            except Exception as exc:  # noqa: BLE001 — ошибка одной строки не должна валить весь импорт
                if file_id:
                    (media_root / file_id).unlink(missing_ok=True)
                res.status = "error"
                res.kind = None
                res.message = str(exc) if isinstance(exc, ValueError) else f"ошибка сохранения: {type(exc).__name__}"
            _done(res)
            if commit_every > 0 and res.status == "created" and report.created % commit_every == 0:
                db.commit()

        report.unused_files = sorted(f.path for f in files.all_files() if f.path not in used_files)
        return report
    finally:
        if zf is not None:
            zf.close()


def spool_upload_to_disk(src: BinaryIO, dest_dir: Path, max_size: int) -> Path:
    """Сохраняет загруженный архив во временный файл (zipfile требует seek)."""
    dest = dest_dir / f".import-{uuid.uuid4().hex}.zip"
    written = 0
    try:
        with dest.open("xb") as out:
            while chunk := src.read(1024 * 1024):
                written += len(chunk)
                if written > max_size:
                    raise ImportFormatError("Архив слишком большой")
                out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    return dest
