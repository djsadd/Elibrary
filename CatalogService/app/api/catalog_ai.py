import os
from urllib.parse import urlparse
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from app.utils.authz import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

async def _forward(path, data, request):
    base = os.getenv("AI_API_BASE", "").rstrip("/")
    if not base:
        raise HTTPException(503, "AI service is not configured")
    if urlparse(base).scheme != "https":
        raise HTTPException(503, "AI_API_BASE must use HTTPS")
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False, trust_env=False) as client:
            response = await client.post(base + path, json=data,
                                         headers={"Authorization": request.headers["authorization"]})
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "AI service unavailable") from exc

@router.post("/chat_card")
async def chat_card(data: dict, request: Request):
    return await _forward("/api/chat_card", data, request)

@router.post("/generate_llm_context")
async def generate_llm_context(data: dict, request: Request):
    return await _forward("/api/generate_llm_context", data, request)
