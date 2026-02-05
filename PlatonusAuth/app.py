import os
import logging
import sys

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from prometheus_fastapi_instrumentator import Instrumentator
from pythonjsonlogger import jsonlogger

from register import auth


def setup_logging() -> None:
    level = os.getenv("LOG_LEVEL", "INFO").upper()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    root.propagate = False

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        l = logging.getLogger(logger_name)
        l.handlers = [handler]
        l.setLevel(level)
        l.propagate = False


setup_logging()

app = FastAPI(title="Platonus Auth API")

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


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
