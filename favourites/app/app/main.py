from fastapi import FastAPI
from app.api import favourites
from app.core.db import Base, engine

app = FastAPI(title="Favourites Service")

Base.metadata.create_all(bind=engine)

app.include_router(favourites.router, prefix="/favourites")
