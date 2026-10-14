import time

from fastapi import APIRouter

from core.config import settings
from core.jwks_check import check_jwks

router = APIRouter(
    prefix="/health",
    tags=["Health"],
)

_AUTH_CHECK_TTL_SECONDS = 15
_auth_cache: tuple[float, dict] | None = None


@router.get("/")
async def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


@router.get("/auth")
def auth_health() -> dict:
    """Report whether this server can fetch Supabase's signing keys, which login checks depend on.

    Returns no secrets. Cached briefly so it cannot be used to hammer Supabase.
    """
    global _auth_cache
    now = time.monotonic()
    if _auth_cache is not None and now - _auth_cache[0] < _AUTH_CHECK_TTL_SECONDS:
        return _auth_cache[1]
    result = check_jwks()
    result["status"] = "ok" if result["jwks_reachable"] and result["jwks_key_count"] else "error"
    _auth_cache = (now, result)
    return result
