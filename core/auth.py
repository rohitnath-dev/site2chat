import logging
import time

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError

from core.config import settings
from core.jwks_check import (
    JWKS_HEADERS,
    JWKS_TIMEOUT_SECONDS,
    describe_connection_error,
    jwks_url,
)

logger = logging.getLogger("site2chat.auth")

# A JWKS fetch can fail transiently (cold start, brief network blip). Retry before giving up.
JWKS_FETCH_ATTEMPTS = 3
JWKS_RETRY_DELAY_SECONDS = 0.5

bearer_scheme = HTTPBearer(auto_error=False)
_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient:
    """Return the cached Supabase JWKS client."""
    global _jwks_client

    if not settings.SUPABASE_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase authentication is not configured.",
        )

    if _jwks_client is None:
        _jwks_client = PyJWKClient(
            jwks_url(),
            cache_keys=True,
            timeout=JWKS_TIMEOUT_SECONDS,
            headers=JWKS_HEADERS,
        )
    return _jwks_client


def _get_signing_key(token: str):
    """Look up the token's signing key, retrying only on connection failures."""
    for attempt in range(1, JWKS_FETCH_ATTEMPTS + 1):
        try:
            return get_jwks_client().get_signing_key_from_jwt(token)
        except PyJWKClientConnectionError as exc:
            logger.warning(
                "Supabase JWKS fetch attempt %d/%d failed: %s",
                attempt,
                JWKS_FETCH_ATTEMPTS,
                describe_connection_error(exc),
            )
            if attempt == JWKS_FETCH_ATTEMPTS:
                raise
            time.sleep(JWKS_RETRY_DELAY_SECONDS)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """Validate a Supabase access token and return its claims."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not settings.SUPABASE_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase authentication is not configured.",
        )

    issuer = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"

    try:
        signing_key = _get_signing_key(credentials.credentials)
        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=issuer,
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
    except PyJWKClientConnectionError as exc:
        # Log the real reason (no token or key material) so it is visible in server logs.
        logger.error("Supabase JWKS fetch failed: %s", describe_connection_error(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        # Log only the exception class (never the token) so 401 causes are distinguishable:
        # ExpiredSignatureError, InvalidAudienceError, InvalidIssuerError, PyJWKClientError, ...
        logger.warning("Token rejected: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload
