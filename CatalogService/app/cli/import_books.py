"""Массовый импорт книг из папки на сервере (без загрузки через браузер).

1) Сгенерировать черновик Excel по файлам в папке:
    python -m app.cli.import_books scan /import/books --out /import/books.xlsx

2) Заполнить в Excel «Название», «Автор», «Жанры», «Язык» (колонку «Файл» не трогать).

3) Проверить без записи в БД:
    python -m app.cli.import_books run --excel /import/books.xlsx --files /import/books --dry-run

4) Импортировать:
    python -m app.cli.import_books run --excel /import/books.xlsx --files /import/books

Повторный запуск безопасен: уже созданные книги (то же название + авторы) пропускаются.
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
from dataclasses import asdict
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

from app.services.book_import import (
    ImportFormatError,
    ImportRowResult,
    index_dir,
    import_books,
)


def _guess_from_filename(stem: str) -> tuple[str, str]:
    """«Иванов И.И. - Алгебра_9_класс» -> («Алгебра 9 класс», «Иванов И.И.»). Просто черновик."""
    s = re.sub(r"[_]+", " ", stem)
    s = re.sub(r"\s+", " ", s).strip()
    if re.fullmatch(r"\d+", s):
        return "", ""
    for sep in (" - ", " — ", " – "):
        if sep in s:
            left, right = s.split(sep, 1)
            return right.strip(), left.strip()
    return s, ""


def cmd_scan(args: argparse.Namespace) -> int:
    root = Path(args.folder)
    idx = index_dir(root)
    files = sorted(idx.all_files(), key=lambda f: f.path.lower())
    if not files:
        print(f"В папке {root} не найдено файлов {', '.join(('.pdf', '.epub', '.djvu'))}", file=sys.stderr)
        return 1

    wb = Workbook()
    ws = wb.active
    ws.title = "Книги"
    headers = ["№", "Файл", "Название", "Автор", "Жанры через запятую", "Язык", "Ссылка"]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    fill = PatternFill("solid", fgColor="FFF2CC")  # подсветить, что надо проверить
    for i, f in enumerate(files, start=1):
        title, author = _guess_from_filename(os.path.splitext(f.name)[0]) if args.guess else ("", "")
        ws.append([i, f.path, title, author, "", args.lang or "", ""])
        if args.guess:
            ws.cell(row=i + 1, column=3).fill = fill
            ws.cell(row=i + 1, column=4).fill = fill
    for col, width in zip("ABCDEFG", (7, 50, 50, 35, 30, 12, 40)):
        ws.column_dimensions[col].width = width
    ws.freeze_panes = "A2"

    out = Path(args.out)
    if out.exists() and not args.force:
        print(f"{out} уже существует (используйте --force, чтобы перезаписать)", file=sys.stderr)
        return 1
    wb.save(out)
    total_mb = sum(f.size for f in files) / 1024 / 1024
    print(f"Найдено файлов: {len(files)} ({total_mb:,.0f} МБ). Черновик: {out}")
    if idx.ambiguous_names:
        print(f"Внимание: {len(idx.ambiguous_names)} имён файлов повторяются в разных папках — "
              "в колонке «Файл» уже указан полный путь, его не сокращайте.")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    # Импорты с БД — здесь, чтобы `scan` работал без настроенной базы.
    from app.api.catalog_common import _to_out
    from app.core.db import SessionLocal
    from app.models.book import Book
    from app.services.search_sync import index_book_in_search
    from app.utils.storage import media_root

    root = media_root()
    root.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()

    def on_row(res: ImportRowResult, done: int, total: int) -> None:
        if res.status == "error" or args.verbose:
            print(f"  строка {res.row} [{res.status}] {res.title[:60]!r}: {res.message}")
        if done % 100 == 0 or done == total:
            print(f"[{done}/{total}] {time.monotonic() - started:,.0f} с", flush=True)

    db = SessionLocal()
    try:
        with open(args.excel, "rb") as fp:
            report = import_books(
                db,
                fp,
                None,
                root,
                files_dir=Path(args.files) if args.files else None,
                dry_run=args.dry_run,
                is_public=not args.private,
                skip_duplicates=not args.no_skip_duplicates,
                max_rows=args.max_rows,
                max_file_size=args.max_file_mb * 1024 * 1024,
                commit_every=0 if args.dry_run else args.commit_every,
                on_row=on_row,
            )
        if args.dry_run:
            db.rollback()
        else:
            db.commit()
    except ImportFormatError as exc:
        db.rollback()
        print(f"Ошибка: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        db.commit()  # оставляем то, что уже успели создать; повторный запуск продолжит
        print("\nПрервано. Уже созданные книги сохранены, запустите команду ещё раз для продолжения.")
        return 130

    if args.report:
        with open(args.report, "w", newline="", encoding="utf-8-sig") as out:
            w = csv.DictWriter(out, fieldnames=["row", "num", "title", "status", "message", "book_id", "kind"],
                               delimiter=";")
            w.writeheader()
            for r in report.rows:
                w.writerow(asdict(r))

    if not args.dry_run and report.created_book_ids and not args.no_search_index:
        print("Индексация в поиске...")
        ids = report.created_book_ids
        for i in range(0, len(ids), 200):
            for b in db.query(Book).filter(Book.id.in_(ids[i:i + 200])).all():
                index_book_in_search(_to_out(b).model_dump())
    db.close()

    mode = "ПРОВЕРКА (dry-run), в БД ничего не записано" if args.dry_run else "ИМПОРТ"
    print(f"\n{mode}: строк {report.total_rows}, создано {report.created} "
          f"(с файлом {report.with_file}, внешних {report.external}), "
          f"пропущено {report.skipped}, ошибок {report.errors}")
    if report.unused_files:
        print(f"Файлы в папке, не привязанные ни к одной строке: {len(report.unused_files)}")
        for name in report.unused_files[:20]:
            print(f"  {name}")
        if len(report.unused_files) > 20:
            print("  ...")
    if args.report:
        print(f"Подробный отчёт: {args.report}")
    return 1 if report.errors else 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m app.cli.import_books", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("scan", help="создать черновик Excel по файлам в папке")
    s.add_argument("folder", help="папка с книгами (ищется рекурсивно)")
    s.add_argument("--out", required=True, help="куда сохранить .xlsx")
    s.add_argument("--lang", help="язык по умолчанию для всех строк (например Russian)")
    s.add_argument("--no-guess", dest="guess", action="store_false",
                   help="не угадывать название/автора из имени файла")
    s.add_argument("--force", action="store_true", help="перезаписать существующий файл")
    s.set_defaults(func=cmd_scan)

    r = sub.add_parser("run", help="импортировать книги из Excel + папки")
    r.add_argument("--excel", required=True, help="Excel .xlsx с описанием книг")
    r.add_argument("--files", help="папка с файлами книг")
    r.add_argument("--dry-run", action="store_true", help="только проверить, ничего не записывать")
    r.add_argument("--private", action="store_true", help="создавать книги скрытыми (не публичными)")
    r.add_argument("--no-skip-duplicates", action="store_true", help="не пропускать уже существующие книги")
    r.add_argument("--max-rows", type=int, default=200_000, help="максимум строк в Excel (по умолчанию 200000)")
    r.add_argument("--max-file-mb", type=int, default=1024, help="максимальный размер одного файла, МБ")
    r.add_argument("--commit-every", type=int, default=200, help="коммитить каждые N книг (по умолчанию 200)")
    r.add_argument("--report", help="сохранить построчный отчёт в CSV")
    r.add_argument("--no-search-index", action="store_true", help="не отправлять книги в SearchService")
    r.add_argument("-v", "--verbose", action="store_true", help="печатать каждую строку")
    r.set_defaults(func=cmd_run)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
