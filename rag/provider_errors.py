"""Classify AI provider failures and remember confirmed credit/key problems.

Nothing here returns raw provider responses: callers get a short, safe error code. Provider
diagnostics go to the server log only, with keys and token-like strings redacted.
"""

import logging
import re
import threading
import time

logger = logging.getLogger("site2chat.llm")

# Safe, stable codes. The frontend and tests rely on these exact values.
CODE_CREDITS = "provider_credits_exhausted"  # confirmed credit / billing / quota problem
CODE_KEY_INVALID = "provider_key_invalid"  # provider rejected the API key
CODE_RATE_LIMITED = "provider_rate_limited"  # too many requests; NOT a credit problem
CODE_UNAVAILABLE = "provider_unavailable"  # network error or provider-side 5xx
CODE_OTHER = "provider_error"  # anything we cannot identify confidently

RETRYABLE_CODES = {CODE_RATE_LIMITED, CODE_UNAVAILABLE}

# Only explicit credit/quota wording counts as confirmation. Rate-limit texts from providers often
# mention "billing" or "upgrade", so a bare "billing" in a message is deliberately NOT enough.
_CREDIT_FIELD_TOKENS = (
    "insufficient_quota",
    "insufficient_credits",
    "insufficient_funds",
    "billing_hard_limit",
    "billing_not_active",
    "billing_error",
    "payment_required",
)
_CREDIT_MESSAGE_PHRASES = (
    "insufficient credits",
    "insufficient_quota",
    "insufficient funds",
    "exceeded your current quota",
    "credit balance",
    "out of credits",
    "add more credits",
    "no credits",
)
_RATE_LIMIT_FIELDS = ("rate_limit_exceeded", "rate_limit", "too_many_requests")


class ProviderError(RuntimeError):
    """A provider call failed. Carries only a safe code, never the provider's response body."""

    def __init__(self, code: str, provider: str, http_status: int | None = None) -> None:
        super().__init__(f"{provider} request failed ({code}, HTTP {http_status})")
        self.code = code
        self.provider = provider
        self.http_status = http_status


_SECRET_PATTERNS = (
    re.compile(r"Bearer\s+\S+", re.IGNORECASE),
    re.compile(r"\b(?:sk|gsk|or)[-_][A-Za-z0-9_\-]{8,}"),
)


def redact(text: str, api_key: str | None = None, limit: int = 200) -> str:
    if api_key:
        text = text.replace(api_key, "[redacted]")
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub("[redacted]", text)
    return text[:limit]


def _error_fields(payload: object) -> tuple[str, str, str]:
    """Return lowercase (code, type, message) from a provider error body, tolerating any shape."""
    if not isinstance(payload, dict):
        return "", "", ""
    error = payload.get("error")
    if isinstance(error, str):
        return "", "", error.lower()
    if not isinstance(error, dict):
        return "", "", ""
    code, kind, message = error.get("code"), error.get("type"), error.get("message")
    return (
        str(code).lower() if isinstance(code, (str, int)) else "",
        str(kind).lower() if isinstance(kind, str) else "",
        message.lower() if isinstance(message, str) else "",
    )


def classify(http_status: int, payload: object) -> str:
    """Map a failed provider response to one safe code. Unknown cases never claim a credit problem."""
    code, kind, message = _error_fields(payload)

    if http_status == 402:
        return CODE_CREDITS
    if http_status == 401:
        return CODE_KEY_INVALID

    if code in _RATE_LIMIT_FIELDS or kind in _RATE_LIMIT_FIELDS:
        return CODE_RATE_LIMITED

    credit_confirmed = any(t in code or t in kind for t in _CREDIT_FIELD_TOKENS) or any(
        p in message for p in _CREDIT_MESSAGE_PHRASES
    )
    if credit_confirmed and http_status in (400, 403, 429):
        return CODE_CREDITS

    if http_status == 429:
        return CODE_RATE_LIMITED
    if http_status >= 500:
        return CODE_UNAVAILABLE
    return CODE_OTHER


def log_failure(provider: str, http_status: int | None, code: str, payload: object, api_key: str | None) -> None:
    """Server-side diagnostics only; redacted and truncated."""
    err_code, err_type, message = _error_fields(payload)
    logger.warning(
        "AI provider call failed: provider=%s http=%s class=%s code=%s type=%s message=%s",
        provider,
        http_status,
        code,
        redact(err_code, api_key, 60),
        redact(err_type, api_key, 60),
        redact(message, api_key),
    )


# --- Remembered issues -----------------------------------------------------------------------
# In-memory (no schema change): one entry for the shared default provider, one per owner for their
# own OpenRouter key. Cleared as soon as a call succeeds or the owner changes their key. Entries also
# expire, so a warning cannot outlive a provider that recovered while nobody was chatting.

ISSUE_TTL_SECONDS = 30 * 60
DEFAULT_SCOPE = "default"

_issues: dict[str, tuple[str, float]] = {}
_lock = threading.Lock()


def owner_scope(owner_id: str) -> str:
    return f"owner:{owner_id}"


def record_issue(scope: str, code: str) -> None:
    """Remember only problems the owner can act on or that make the default provider unusable."""
    if code not in (CODE_CREDITS, CODE_KEY_INVALID):
        return
    with _lock:
        _issues[scope] = (code, time.monotonic() + ISSUE_TTL_SECONDS)


def clear_issue(scope: str) -> None:
    with _lock:
        _issues.pop(scope, None)


def get_issue(scope: str) -> str | None:
    with _lock:
        entry = _issues.get(scope)
        if entry is None:
            return None
        if entry[1] <= time.monotonic():
            del _issues[scope]
            return None
        return entry[0]


def reset_all() -> None:  # for tests
    with _lock:
        _issues.clear()
