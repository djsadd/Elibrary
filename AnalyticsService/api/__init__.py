from .routes import router
from .insights import router as insights_router

router.include_router(insights_router)
