import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from register import auth


app = FastAPI(title="Platonus Auth API")


class Credentials(BaseModel):
    username: str | None = None
    password: str | None = None


@app.post("/auth_platonus")
def auth_platonus(credentials: Credentials):
    # Логин и пароль берём только из переменных окружения (.env)
    username = credentials.username
    password = credentials.password

    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail=(
                "Credentials not provided. Set PLATONUS_USERNAME and PLATONUS_PASSWORD "
                "environment variables."
            ),
        )

    try:
        response = auth(username, password)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=401, detail=str(exc)
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch notifications: {exc}"
        ) from exc

    return {"role": response["role"], "info": response["info"]}
