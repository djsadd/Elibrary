"""Serve files with HTTP Range support so the PDF reader can fetch only the pages it needs.

pdf.js (with disableStream/disableAutoFetch) requests byte ranges such as ``bytes=0-65535``.
For that to work the response must advertise ``Accept-Ranges: bytes`` and a stable
``Content-Length``, and every ranged request must be answered with ``206 Partial Content``.
"""
import os
import re
from pathlib import Path
from typing import Iterator, Optional

from fastapi import Request
from fastapi.responses import Response, StreamingResponse

_CHUNK = 64 * 1024
# Hard cap for one ranged response, so a single request can never pull a whole large book.
MAX_RANGE_BYTES = 4 * 1024 * 1024
_RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


def _parse_range(header: str, size: int) -> Optional[tuple[int, int]]:
    """Return inclusive (start, end) or None when the header is unusable. Raises ValueError if unsatisfiable."""
    m = _RANGE_RE.match(header.strip())
    if not m:
        return None  # multi-range or garbage: ignore, serve per default policy
    first, last = m.groups()
    if first == "" and last == "":
        return None
    if first == "":  # suffix range: last N bytes
        length = int(last)
        if length <= 0:
            raise ValueError("unsatisfiable")
        start, end = max(size - length, 0), size - 1
    else:
        start = int(first)
        end = int(last) if last else size - 1
        if start >= size or end < start:
            raise ValueError("unsatisfiable")
        end = min(end, size - 1)
    if end - start + 1 > MAX_RANGE_BYTES:
        end = start + MAX_RANGE_BYTES - 1
    return start, end


def _iter_file(path: Path, start: int, length: int) -> Iterator[bytes]:
    with path.open("rb") as fh:
        fh.seek(start)
        remaining = length
        while remaining > 0:
            data = fh.read(min(_CHUNK, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


def ranged_file_response(
    request: Request,
    path: Path,
    media_type: str,
    headers: Optional[dict] = None,
) -> Response:
    stat = os.stat(path)
    size = stat.st_size
    etag = f'"{stat.st_mtime_ns:x}-{size:x}"'
    base_headers = {
        "Accept-Ranges": "bytes",
        "ETag": etag,
        # Byte offsets must stay raw: forbid proxies from re-encoding (gzip) the PDF.
        "Cache-Control": "private, max-age=3600, no-transform",
        **(headers or {}),
    }

    range_header = request.headers.get("range")
    if_range = request.headers.get("if-range")
    if range_header and (not if_range or if_range == etag):
        try:
            parsed = _parse_range(range_header, size)
        except ValueError:
            return Response(
                status_code=416,
                headers={**base_headers, "Content-Range": f"bytes */{size}"},
            )
        if parsed is not None:
            start, end = parsed
            length = end - start + 1
            return StreamingResponse(
                _iter_file(path, start, length),
                status_code=206,
                media_type=media_type,
                headers={
                    **base_headers,
                    "Content-Range": f"bytes {start}-{end}/{size}",
                    "Content-Length": str(length),
                },
            )

    if request.method == "HEAD":
        return Response(status_code=200, media_type=media_type, headers={**base_headers, "Content-Length": str(size)})

    return StreamingResponse(
        _iter_file(path, 0, size),
        status_code=200,
        media_type=media_type,
        headers={**base_headers, "Content-Length": str(size)},
    )
