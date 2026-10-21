import httpx
from app.core.config import settings

async def get_book_data(book_id: int, token: str):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{settings.CATALOG_SERVICE_URL}/books/{book_id}", headers={"Authorization": f"Bearer {token}"})
        if resp.status_code == 200:
            return resp.json()
        return None

async def get_user_data(user_id: int):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{settings.USER_SERVICE_URL}/users/{user_id}")
        if resp.status_code == 200:
            return resp.json()
        return None
