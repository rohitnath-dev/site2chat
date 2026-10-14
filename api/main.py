import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

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

# Exact browser origins allowed to call this API (comma-separated).
# Set FRONTEND_ORIGINS to the deployed frontend origin in production.
_frontend_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "FRONTEND_ORIGINS", "http://localhost:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

logger = logging.getLogger("site2chat.api")


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Turn database failures into a readable JSON error.

    Without this, an unhandled error becomes a bare 500 that Starlette builds outside the CORS
    middleware, so browsers hide it and the frontend only sees a failed network request.
    """
    orig = getattr(exc, "orig", None) or exc
    first_line = (str(orig).splitlines() or [""])[0][:300]
    logger.error(
        "Database error on %s %s: %s: %s",
        request.method,
        request.url.path,
        type(orig).__name__,
        first_line,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "The server couldn't save or load your data. Please try again; "
            "if it keeps happening, contact support."
        },
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