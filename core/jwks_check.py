"""Diagnostics for the Supabase JWKS endpoint used to verify login tokens.

Standard library only, so it can be tested without the web framework. Nothing
here reads or returns tokens, keys or secrets.
"""

import json
import socket
import urllib.error
import urllib.request

from core.config import settings

JWKS_TIMEOUT_SECONDS = 10
# Some CDNs reject the default "Python-urllib" user agent, so identify ourselves.
JWKS_HEADERS = {"User-Agent": "site2chat-api/1.0"}


def jwks_url() -> str:
    return f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _http_hint(code: int) -> str:
    if code == 404:
        return (
            "HTTP 404: the JWKS path was not found. SUPABASE_URL should be exactly "
            "https://<project-ref>.supabase.co with no extra path."
        )
    if 300 <= code < 400:
        return (
            f"HTTP {code}: the URL redirects. Use the exact https://<project-ref>.supabase.co address."
        )
    if code in (401, 403):
        return f"HTTP {code}: the request was refused. Check the project is active and has no network restrictions."
    return f"HTTP {code}: Supabase returned an error status."


def describe_connection_error(exc: BaseException) -> str:
    """Short, secret-free description of why a JWKS fetch failed (for logs)."""
    cause = exc.__cause__ or exc
    if isinstance(cause, urllib.error.HTTPError):
        return _http_hint(cause.code)
    if isinstance(cause, urllib.error.URLError):
        reason = cause.reason
        if isinstance(reason, (TimeoutError, socket.timeout)):
            return f"timed out after {JWKS_TIMEOUT_SECONDS}s"
        return f"could not connect ({type(reason).__name__})"
    if isinstance(cause, (TimeoutError, socket.timeout)):
        return f"timed out after {JWKS_TIMEOUT_SECONDS}s"
    return type(cause).__name__


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Match PyJWT, which treats a redirect as a failure."""

    def redirect_request(self, *args, **kwargs):  # noqa: D401
        return None


def check_jwks() -> dict:
    """Fetch the JWKS the same way the login check does and report what happened."""
    result: dict = {
        "supabase_configured": bool(settings.SUPABASE_URL),
        "jwks_reachable": False,
        "jwks_http_status": None,
        "jwks_key_count": None,
        "failure": None,
    }
    if not settings.SUPABASE_URL:
        result["failure"] = "SUPABASE_URL is not set."
        return result

    request = urllib.request.Request(jwks_url(), headers=JWKS_HEADERS)
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        with opener.open(request, timeout=JWKS_TIMEOUT_SECONDS) as response:
            result["jwks_http_status"] = response.status
            body = json.load(response)
    except urllib.error.HTTPError as exc:
        result["jwks_http_status"] = exc.code
        result["failure"] = _http_hint(exc.code)
        exc.close()
        return result
    except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
        result["failure"] = describe_connection_error(exc)
        return result
    except ValueError:
        result["failure"] = "The JWKS response was not valid JSON."
        return result

    keys = body.get("keys") if isinstance(body, dict) else None
    count = len(keys) if isinstance(keys, list) else 0
    result["jwks_reachable"] = True
    result["jwks_key_count"] = count
    if count == 0:
        result["failure"] = (
            "The endpoint is reachable but publishes no signing keys. If the Supabase project still uses the "
            "legacy JWT secret, logins cannot be verified: switch the project to JWT signing keys."
        )
    return result
