import httpx

from fastapi import APIRouter, HTTPException

router = APIRouter()

AI_API_BASE = "http://192.168.112.182"


async def login_to_auth_service():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{AI_API_BASE}/auth/login",
            data={
                "username": "erasil.bakhytgan@gmail.com",
                "password": "Polipol1313",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Auth service login failed")
        return response.json()


@router.post("/chat_card")
async def chat_card(data: dict):
    auth_data = await login_to_auth_service()
    token = auth_data.get("access_token")
    if not token:
        raise HTTPException(status_code=500, detail="No token received from auth service")

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{AI_API_BASE}/api/chat_card",
            json=data,
            headers={"Authorization": f"Bearer {token}"},
        )
        return r.json()


@router.post("/generate_llm_context")
async def generate_llm_context(data: dict):
    try:
        auth_data = await login_to_auth_service()
        token = auth_data.get("access_token")
        if not token:
            raise HTTPException(status_code=500, detail="No token received from auth service")

        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{AI_API_BASE}/api/generate_llm_context",
                json=data,
                headers={"Authorization": f"Bearer {token}"},
            )
            try:
                return r.json()
            except Exception:
                return {"text": r.text}

    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))