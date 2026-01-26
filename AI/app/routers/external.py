import os
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException, Body
from dotenv import load_dotenv
from pydantic import BaseModel
import requests

load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env")

router = APIRouter()

CHAT_CARD_URL = os.getenv("AI_CHAT_CARD_URL", "http://192.168.112.182/api/chat_card")


class ChatCardPayload(BaseModel):
    query: str


@router.get("/post/{post_id}")
def get_post(post_id: int):
    return {
        "source": "jsonplaceholder",
    }


def chat_card_external_service(authorization: str, payload: dict):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    headers = {"Authorization": authorization}
    try:
        response = requests.post(
            CHAT_CARD_URL,
            json=payload,
            headers=headers,
            timeout=15,
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
