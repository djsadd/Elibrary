from fastapi import FastAPI
from app.api.routes import router

from app.core.db import Base, engine
from app.core.db import init_db


app = FastAPI(title="AuthService", version="0.1.0")
Base.metadata.create_all(bind=engine)
app.include_router(router)


init_db()


@app.get("/health")
def health(): return {"status": "ok", "service": "auth"}
