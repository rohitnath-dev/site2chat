from fastapi import FastAPI

from core.config import settings
from api.health import router as health_router
from api.chatbots import router as chatbots_router
from api.chat import router as chat_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
    description="Backend API for site2chat.",
)

app.include_router(
    health_router,
    prefix=settings.API_V1_PREFIX,
)

app.include_router(
    chatbots_router,
    prefix=settings.API_V1_PREFIX,
)

app.include_router(
    chat_router,
    prefix=settings.API_V1_PREFIX,
)


@app.get("/", tags=["Root"])
async def root() -> dict[str, str]:
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "running",
    }