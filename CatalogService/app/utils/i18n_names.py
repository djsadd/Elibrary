"""Helpers for three-language names (ru / kk / en) of authors and subjects."""
import re

LANGS = ("ru", "kk", "en")

_KAZAKH_ONLY = re.compile(r"[әіңғүұқөһӘІҢҒҮҰҚӨҺ]")
_CYRILLIC = re.compile(r"[\u0400-\u04FF]")
_LATIN = re.compile(r"[A-Za-z]")


def detect_lang(text: str | None) -> str | None:
    """Guess the language of a name by its alphabet: kk, ru or en."""
    if not text:
        return None
    if _KAZAKH_ONLY.search(text):
        return "kk"
    if _CYRILLIC.search(text):
        return "ru"
    if _LATIN.search(text):
        return "en"
    return None


def fill_detected_lang(obj) -> None:
    """Put obj.name into the empty name_<lang> column matching its alphabet."""
    lang = detect_lang(obj.name)
    if lang and not (getattr(obj, f"name_{lang}") or "").strip():
        setattr(obj, f"name_{lang}", obj.name)


def clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None
