from __future__ import annotations

from fastapi import Request


def get_lang(request: Request) -> str:
    raw = (request.headers.get("x-ui-lang") or request.headers.get("accept-language") or "").lower()
    # quick parse: pick first matching supported language
    for token in raw.replace(";", ",").split(","):
        t = token.strip()
        if not t:
            continue
        if t.startswith("ru"):
            return "ru"
        if t.startswith("kk") or t.startswith("kz"):
            return "kk"
        if t.startswith("en"):
            return "en"
    return "en"

