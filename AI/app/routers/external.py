import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Body
from dotenv import load_dotenv
from pydantic import BaseModel
import requests

load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env")

router = APIRouter()

AUTH_LOGIN_URL = os.getenv("AI_AUTH_LOGIN_URL", "http://192.168.112.182/auth/login")
CHAT_CARD_URL = os.getenv("AI_CHAT_CARD_URL", "http://192.168.112.182/api/chat_card")
EXTERNAL_USERNAME = os.getenv("AI_EXTERNAL_USERNAME", "")
EXTERNAL_PASSWORD = os.getenv("AI_EXTERNAL_PASSWORD", "")


class ChatCardPayload(BaseModel):
    query: str


@router.get("/post/{post_id}")
def get_post(post_id: int):
    return {
        "source": "jsonplaceholder",
    }


def login_external_service(username: str, password: str):
    if not username or not password:
        raise HTTPException(status_code=500, detail="External auth credentials missing")
    print("Logging in to external service...")
    print(f"Username: {username}")
    try:
        response = requests.post(
            AUTH_LOGIN_URL,
            data={"username": username, "password": password},
            timeout=5,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Auth service unavailable") from exc

    if response.status_code != 200:
        detail = "Auth failed"
        try:
            detail = response.json().get("detail", detail)
        except ValueError:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)

    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid auth response") from exc


def chat_card_external_service(username: str, password: str, payload: dict):
    auth_data = login_external_service(username, password)
    token = auth_data.get("access_token")
    token_type = auth_data.get("token_type", "bearer")
    if not token:
        raise HTTPException(status_code=502, detail="Auth token missing")

    headers = {"Authorization": f"{token_type.capitalize()} {token}"}
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
):
    return chat_card_external_service(
        EXTERNAL_USERNAME,
        EXTERNAL_PASSWORD,
        payload.dict(),
    )
