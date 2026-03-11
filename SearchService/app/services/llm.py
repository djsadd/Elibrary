from __future__ import annotations

import httpx

from app.core.config import settings
from app.schemas.books import BookDoc, StudentProfile


def _configured_api_key() -> str:
    return (settings.OPENAI_API_KEY or settings.OPENAI_SECRET_KEY or "").strip()


def openai_enabled() -> bool:
    return bool(_configured_api_key())


def _student_label(profile: StudentProfile | None) -> str:
    if not profile:
        return "student"

    parts = [
        " ".join(x for x in [profile.first_name, profile.last_name] if x),
        profile.role,
        profile.faculty,
        profile.group_name,
        profile.institution,
    ]
    return ", ".join(part.strip() for part in parts if part and str(part).strip()) or "student"


def fallback_explanation(book: BookDoc, student_query: str | None, student_profile: StudentProfile | None) -> str:
    reasons: list[str] = []

    if student_query:
        reasons.append(f"Запрос студента связан с темой: {student_query.strip()}.")
    if book.subjects:
        reasons.append(f"Книга покрывает направления: {', '.join(book.subjects[:4])}.")
    if book.summary:
        reasons.append(f"По описанию она полезна тем, что {book.summary.strip()[:220].rstrip(' .,;:')}.".strip())
    if book.authors:
        reasons.append(f"Авторский фокус: {', '.join(book.authors[:2])}.")
    if book.year:
        reasons.append(f"Издание {book.year} года может быть актуально для учебной работы.")

    intro = f"Эта книга может подойти именно {_student_label(student_profile)}"
    if reasons:
        return f"{intro}, потому что " + " ".join(reasons)
    return f"{intro}, потому что её тема и содержание совпадают с учебным интересом и задачами поиска."


def _build_prompt(book: BookDoc, student_query: str | None, student_profile: StudentProfile | None) -> str:
    profile_bits = []
    if student_profile:
        for label, value in [
            ("Имя", " ".join(x for x in [student_profile.first_name, student_profile.last_name] if x).strip()),
            ("Роль", student_profile.role),
            ("Факультет", student_profile.faculty),
            ("Группа", student_profile.group_name),
            ("Учебное заведение", student_profile.institution),
        ]:
            if value and str(value).strip():
                profile_bits.append(f"{label}: {value}")

    subjects = ", ".join(book.subjects) if book.subjects else "не указаны"
    authors = ", ".join(book.authors) if book.authors else "не указаны"
    summary = book.summary or "нет описания"
    query = student_query or "не указан"

    return (
        "Ты библиотечный AI-ассистент университета. "
        "Твоя задача — кратко объяснить студенту, почему именно эта книга может быть ему полезна.\n\n"

        "Правила ответа:\n"
        "- Пиши на русском языке.\n"
        "- Длина ответа: 2–4 предложения.\n"
        "- Не используй markdown, списки и служебные пояснения.\n"
        "- Не пересказывай книгу подробно.\n"
        "- Не выдумывай факты о студенте.\n"
        "- Обязательно свяжи запрос студента, его профиль (если указан) и тему книги.\n"
        "- Если информации мало, честно укажи, что книга подходит по теме запроса.\n\n"

        "Данные:\n"
        f"Запрос студента: {query}\n"
        f"Профиль студента: {'; '.join(profile_bits) if profile_bits else 'не указан'}\n"
        f"Название книги: {book.title}\n"
        f"Авторы: {authors}\n"
        f"Темы: {subjects}\n"
        f"Год: {book.year or 'не указан'}\n"
        f"Язык: {book.lang or 'не указан'}\n"
        f"Описание книги: {summary}\n\n"

        "Пример хорошего ответа:\n"
        "Эта книга может быть полезна студенту, так как его запрос связан с философией. "
        "В ней рассматривается происхождение философии и ее место в культуре, что помогает понять основные идеи этой дисциплины. "
        "Поэтому она может быть полезна для знакомства с базовыми философскими понятиями."
    )


async def generate_book_explanation(
    *,
    book: BookDoc,
    student_query: str | None,
    student_profile: StudentProfile | None,
) -> tuple[str, str | None, str]:
    api_key = _configured_api_key()
    if not api_key:
        return fallback_explanation(book, student_query, student_profile), None, "fallback"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.OPENAI_MODEL,
        "input": _build_prompt(book, student_query, student_profile),
    }

    async with httpx.AsyncClient(timeout=settings.OPENAI_TIMEOUT_S) as client:
        response = await client.post("https://api.openai.com/v1/responses", headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    text = (data.get("output_text") or "").strip()
    if text:
        return text, settings.OPENAI_MODEL, "openai"

    return fallback_explanation(book, student_query, student_profile), settings.OPENAI_MODEL, "fallback"
