import os
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException, Body, Depends
from dotenv import load_dotenv
from app.utils.authz import get_current_user
from app.core.config import settings
from pydantic import BaseModel
import requests

load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env")

router = APIRouter(dependencies=[Depends(get_current_user)])

CHAT_CARD_URL = settings.AI_CHAT_CARD_URL


class ChatCardPayload(BaseModel):
    query: str = __import__("pydantic").Field(min_length=1, max_length=8000)


@router.get("/post/{post_id}")
def get_post(post_id: int):
    return {
        "source": "jsonplaceholder",
    }


def chat_card_external_service(authorization: str, payload: dict):
    if not CHAT_CARD_URL:
        raise HTTPException(503, "AI service is not configured")
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    from urllib.parse import urlparse
    if urlparse(CHAT_CARD_URL).scheme != "https":
        raise HTTPException(503, "AI_CHAT_CARD_URL must use HTTPS")
    headers = {"Authorization": authorization}
    try:
        response = requests.post(
            CHAT_CARD_URL,
            json=payload,
            headers=headers,
            timeout=15,
            allow_redirects=False,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Chat card service unavailable") from exc

    if response.status_code != 200:
        detail = "Chat card failed"
        try:
            detail = response.json().get("detail", detail)
        except ValueError:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)

    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid chat card response") from exc


@router.post("/chat_card")
def chat_card(
    payload: ChatCardPayload = Body(...),
    authorization: str | None = Header(default=None),
):
    return chat_card_external_service(authorization or "", payload.dict())
