import httpx

from fastapi import APIRouter, Depends, HTTPException, Request

from app.utils.authz import AuthUser, get_current_user

router = APIRouter()

AI_API_BASE = "http://192.168.112.182"


@router.post("/chat_card")
async def chat_card(
    data: dict,
    request: Request,
    user: AuthUser = Depends(get_current_user),
):
    authorization = request.headers.get("authorization")
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{AI_API_BASE}/api/chat_card",
            json=data,
            headers={"Authorization": authorization},
        )
        return r.json()


@router.post("/generate_llm_context")
async def generate_llm_context(
    data: dict,
    request: Request,
    user: AuthUser = Depends(get_current_user),
):
    try:
        authorization = request.headers.get("authorization")
        if not authorization:
            raise HTTPException(status_code=401, detail="Missing bearer token")

        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{AI_API_BASE}/api/generate_llm_context",
                json=data,
                headers={"Authorization": authorization},
            )
            try:
                return r.json()
            except Exception:
                return {"text": r.text}

    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
