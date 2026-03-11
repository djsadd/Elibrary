from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator

import httpx

from app.core.config import settings
from app.schemas.books import BookDoc, StudentProfile

UiLang = str


COPY: dict[str, dict[str, str]] = {
    "ru": {
        "student": "студенту",
        "subjects_unknown": "не указаны",
        "authors_unknown": "не указаны",
        "summary_unknown": "нет описания",
        "query_unknown": "не указан",
        "query_reason": "запрос студента связан с темой «{query}».",
        "subjects_reason": "книга раскрывает темы: {subjects}.",
        "summary_reason": "Во фрагменте книги затрагивается следующее: {preview}",
        "authors_reason": "Авторы книги: {authors}.",
        "year_reason": "Издание {year} года может быть полезно для учебной работы.",
        "fallback_intro": "Эта книга может подойти именно {student}, потому что",
        "fallback_default": "Эта книга может подойти именно {student}, потому что тема и содержание книги совпадают с учебным интересом и задачами поиска.",
        "prompt_intro": "Ты библиотечный AI-ассистент университета. Твоя задача - кратко объяснить студенту, почему именно эта книга может быть ему полезна.",
        "prompt_rules": (
            "Правила ответа:\n"
            "- Пиши на русском языке.\n"
            "- Длина ответа: 2-4 предложения.\n"
            "- Не используй markdown, списки и служебные пояснения.\n"
            "- Не пересказывай книгу подробно.\n"
            "- Не выдумывай факты о студенте.\n"
            "- Обязательно свяжи запрос студента, его профиль (если указан) и тему книги.\n"
            "- Если информации мало, честно укажи, что книга подходит по теме запроса."
        ),
        "label_name": "Имя",
        "label_role": "Роль",
        "label_faculty": "Факультет",
        "label_group": "Группа",
        "label_institution": "Учебное заведение",
        "label_query": "Запрос студента",
        "label_profile": "Профиль студента",
        "label_title": "Название книги",
        "label_authors": "Авторы",
        "label_subjects": "Темы",
        "label_year": "Год",
        "label_lang": "Язык",
        "label_summary": "Описание книги",
        "example_label": "Пример хорошего ответа",
        "example_text": (
            "Эта книга может быть полезна студенту, так как его запрос связан с философией. "
            "В ней рассматривается происхождение философии и ее место в культуре, что помогает понять основные идеи этой дисциплины. "
            "Поэтому она может быть полезна для знакомства с базовыми философскими понятиями."
        ),
    },
    "en": {
        "student": "the student",
        "subjects_unknown": "not specified",
        "authors_unknown": "not specified",
        "summary_unknown": "no description",
        "query_unknown": "not specified",
        "query_reason": "the student's query is related to the topic \"{query}\".",
        "subjects_reason": "the book covers these topics: {subjects}.",
        "summary_reason": "The fragment highlights the following: {preview}",
        "authors_reason": "Book authors: {authors}.",
        "year_reason": "The {year} edition may be useful for academic work.",
        "fallback_intro": "This book may be especially suitable for {student}, because",
        "fallback_default": "This book may be especially suitable for {student}, because its topic and content match the student's academic interest and search intent.",
        "prompt_intro": "You are a university library AI assistant. Your task is to briefly explain why this book may be useful specifically for this student.",
        "prompt_rules": (
            "Answer rules:\n"
            "- Write in English.\n"
            "- Response length: 2-4 sentences.\n"
            "- Do not use markdown, lists, or meta commentary.\n"
            "- Do not retell the book in detail.\n"
            "- Do not invent facts about the student.\n"
            "- Explicitly connect the student's query, profile (if provided), and the book's topic.\n"
            "- If information is limited, honestly say that the book matches the query topic."
        ),
        "label_name": "Name",
        "label_role": "Role",
        "label_faculty": "Faculty",
        "label_group": "Group",
        "label_institution": "Institution",
        "label_query": "Student query",
        "label_profile": "Student profile",
        "label_title": "Book title",
        "label_authors": "Authors",
        "label_subjects": "Topics",
        "label_year": "Year",
        "label_lang": "Language",
        "label_summary": "Book description",
        "example_label": "Example of a good answer",
        "example_text": (
            "This book may be useful for the student because the query is related to philosophy. "
            "It discusses the origins of philosophy and its place in culture, which helps build an understanding of the field's core ideas. "
            "That makes it a strong starting point for learning foundational philosophical concepts."
        ),
    },
    "kk": {
        "student": "студентке",
        "subjects_unknown": "көрсетілмеген",
        "authors_unknown": "көрсетілмеген",
        "summary_unknown": "сипаттама жоқ",
        "query_unknown": "көрсетілмеген",
        "query_reason": "студенттің сұранысы «{query}» тақырыбымен байланысты.",
        "subjects_reason": "кітап мына тақырыптарды қамтиды: {subjects}.",
        "summary_reason": "Кітап үзіндісінде мына ойлар қозғалады: {preview}",
        "authors_reason": "Кітап авторлары: {authors}.",
        "year_reason": "{year} жылғы басылым оқу жұмысына пайдалы болуы мүмкін.",
        "fallback_intro": "Бұл кітап дәл {student} пайдалы болуы мүмкін, себебі",
        "fallback_default": "Бұл кітап дәл {student} пайдалы болуы мүмкін, себебі оның тақырыбы мен мазмұны студенттің оқу қызығушылығы мен іздеу мақсатына сәйкес келеді.",
        "prompt_intro": "Сен университет кітапханасының AI-көмекшісісің. Міндетің - неге дәл осы кітап осы студентке пайдалы болуы мүмкін екенін қысқаша түсіндіру.",
        "prompt_rules": (
            "Жауап ережелері:\n"
            "- Қазақ тілінде жаз.\n"
            "- Жауап ұзындығы: 2-4 сөйлем.\n"
            "- Markdown, тізімдер және қызметтік түсіндірмелер қолданба.\n"
            "- Кітапты толық мазмұндама.\n"
            "- Студент туралы ойдан факт қоспа.\n"
            "- Студенттің сұранысын, профилін (бар болса) және кітап тақырыбын байланыстырып жаз.\n"
            "- Ақпарат аз болса, кітап сұраныс тақырыбына сай келетінін ашық айт."
        ),
        "label_name": "Аты-жөні",
        "label_role": "Рөлі",
        "label_faculty": "Факультет",
        "label_group": "Тобы",
        "label_institution": "Оқу орны",
        "label_query": "Студент сұранысы",
        "label_profile": "Студент профилі",
        "label_title": "Кітап атауы",
        "label_authors": "Авторлар",
        "label_subjects": "Тақырыптар",
        "label_year": "Жылы",
        "label_lang": "Тілі",
        "label_summary": "Кітап сипаттамасы",
        "example_label": "Жақсы жауап үлгісі",
        "example_text": (
            "Бұл кітап студентке пайдалы болуы мүмкін, себебі оның сұранысы философиямен байланысты. "
            "Кітапта философияның пайда болуы мен мәдениеттегі орны қарастырылады, бұл пәннің негізгі идеяларын түсінуге көмектеседі. "
            "Сондықтан ол философияның базалық ұғымдарымен танысуға жақсы негіз бола алады."
        ),
    },
}


def _copy(ui_language: UiLang | None) -> dict[str, str]:
    lang = (ui_language or "ru").strip().lower()
    if lang.startswith("kk") or lang.startswith("kz"):
        return COPY["kk"]
    if lang.startswith("en"):
        return COPY["en"]
    return COPY["ru"]


def _configured_api_key() -> str:
    return (settings.OPENAI_API_KEY or settings.OPENAI_SECRET_KEY or "").strip()


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_configured_api_key()}",
        "Content-Type": "application/json",
    }


def openai_enabled() -> bool:
    return bool(_configured_api_key())


def _student_label(profile: StudentProfile | None, ui_language: UiLang | None) -> str:
    localized = _copy(ui_language)
    if not profile:
        return localized["student"]

    full_name = " ".join(x for x in [profile.first_name, profile.last_name] if x).strip()
    if full_name:
        return full_name
    return localized["student"]


def _clean_text(value: str | None) -> str:
    text = str(value or "").replace("\r", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\bстр\.\s*\d+\b", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"\bpage\s*\d+\b", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"\bбет\s*\d+\b", "", text, flags=re.IGNORECASE).strip()
    return text


def _snippet_preview(value: str | None, max_len: int = 260) -> str:
    text = _clean_text(value)
    if not text:
        return ""

    sentence_match = re.search(rf"^(.{{1,{max_len}}}[.!?])(?:\s|$)", text)
    if sentence_match:
        return sentence_match.group(1).strip()

    if len(text) <= max_len:
        return text

    cut = text[:max_len]
    last_space = cut.rfind(" ")
    if last_space > 80:
        cut = cut[:last_space]
    return cut.rstrip(" ,;:-") + "..."


def fallback_explanation(
    book: BookDoc,
    student_query: str | None,
    student_profile: StudentProfile | None,
    ui_language: UiLang | None = None,
) -> str:
    localized = _copy(ui_language)
    reasons: list[str] = []

    if student_query and student_query.strip():
        reasons.append(localized["query_reason"].format(query=student_query.strip()))
    if book.subjects:
        reasons.append(localized["subjects_reason"].format(subjects=", ".join(book.subjects[:4])))
    if book.summary:
        preview = _snippet_preview(book.summary)
        if preview:
            reasons.append(localized["summary_reason"].format(preview=preview))
    if book.authors:
        reasons.append(localized["authors_reason"].format(authors=", ".join(book.authors[:2])))
    if book.year:
        reasons.append(localized["year_reason"].format(year=book.year))

    student = _student_label(student_profile, ui_language)
    intro = localized["fallback_intro"].format(student=student)
    if reasons:
        return f"{intro} " + " ".join(reasons)
    return localized["fallback_default"].format(student=student)


def _build_prompt(
    book: BookDoc,
    student_query: str | None,
    student_profile: StudentProfile | None,
    ui_language: UiLang | None = None,
) -> str:
    localized = _copy(ui_language)
    profile_bits = []
    if student_profile:
        for label, value in [
            (localized["label_name"], " ".join(x for x in [student_profile.first_name, student_profile.last_name] if x).strip()),
            (localized["label_role"], student_profile.role),
            (localized["label_faculty"], student_profile.faculty),
            (localized["label_group"], student_profile.group_name),
            (localized["label_institution"], student_profile.institution),
        ]:
            if value and str(value).strip():
                profile_bits.append(f"{label}: {value}")

    subjects = ", ".join(book.subjects) if book.subjects else localized["subjects_unknown"]
    authors = ", ".join(book.authors) if book.authors else localized["authors_unknown"]
    summary = _clean_text(book.summary) or localized["summary_unknown"]
    query = student_query or localized["query_unknown"]

    return (
        f"{localized['prompt_intro']}\n\n"
        f"{localized['prompt_rules']}\n\n"
        f"{localized['label_query']}: {query}\n"
        f"{localized['label_profile']}: {'; '.join(profile_bits) if profile_bits else localized['query_unknown']}\n"
        f"{localized['label_title']}: {book.title}\n"
        f"{localized['label_authors']}: {authors}\n"
        f"{localized['label_subjects']}: {subjects}\n"
        f"{localized['label_year']}: {book.year or localized['query_unknown']}\n"
        f"{localized['label_lang']}: {book.lang or localized['query_unknown']}\n"
        f"{localized['label_summary']}: {summary}\n\n"
        f"{localized['example_label']}:\n"
        f"{localized['example_text']}"
    )


def _chunk_text(text: str, chunk_size: int = 24) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and len(candidate) > chunk_size:
            chunks.append(f"{current} ")
            current = word
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def _extract_stream_delta(payload: dict) -> str:
    if isinstance(payload.get("delta"), str):
        return payload["delta"]
    item = payload.get("item")
    if isinstance(item, dict) and isinstance(item.get("delta"), str):
        return item["delta"]
    output = payload.get("output")
    if isinstance(output, list):
        for part in output:
            if isinstance(part, dict) and isinstance(part.get("delta"), str):
                return part["delta"]
    return ""


async def stream_book_explanation(
    *,
    book: BookDoc,
    student_query: str | None,
    student_profile: StudentProfile | None,
    ui_language: UiLang | None = None,
) -> AsyncIterator[str]:
    api_key = _configured_api_key()
    if not api_key:
        for chunk in _chunk_text(fallback_explanation(book, student_query, student_profile, ui_language)):
            yield chunk
        return

    payload = {
        "model": settings.OPENAI_MODEL,
        "input": _build_prompt(book, student_query, student_profile, ui_language),
        "stream": True,
    }

    accumulated: list[str] = []
    yielded = False

    try:
        async with httpx.AsyncClient(timeout=settings.OPENAI_TIMEOUT_S) as client:
            async with client.stream("POST", "https://api.openai.com/v1/responses", headers=_headers(), json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    delta = _extract_stream_delta(event)
                    if delta:
                        accumulated.append(delta)
                        yielded = True
                        yield delta
        if yielded:
            return
    except Exception:
        pass

    explanation, _, _ = await generate_book_explanation(
        book=book,
        student_query=student_query,
        student_profile=student_profile,
        ui_language=ui_language,
    )
    for chunk in _chunk_text(explanation):
        yield chunk


async def generate_book_explanation(
    *,
    book: BookDoc,
    student_query: str | None,
    student_profile: StudentProfile | None,
    ui_language: UiLang | None = None,
) -> tuple[str, str | None, str]:
    api_key = _configured_api_key()
    if not api_key:
        return fallback_explanation(book, student_query, student_profile, ui_language), None, "fallback"

    payload = {
        "model": settings.OPENAI_MODEL,
        "input": _build_prompt(book, student_query, student_profile, ui_language),
    }

    async with httpx.AsyncClient(timeout=settings.OPENAI_TIMEOUT_S) as client:
        response = await client.post("https://api.openai.com/v1/responses", headers=_headers(), json=payload)
        response.raise_for_status()
        data = response.json()

    text = (data.get("output_text") or "").strip()
    if text:
        return text, settings.OPENAI_MODEL, "openai"

    return fallback_explanation(book, student_query, student_profile, ui_language), settings.OPENAI_MODEL, "fallback"
