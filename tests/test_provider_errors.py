"""Provider failure classification, retry behaviour and the remembered-issue registry (mocked HTTP)."""

import logging
from unittest.mock import MagicMock, patch

import pytest
import requests

from rag import provider_errors as pe
from rag.llm import _invoke_chat_completion

SECRET = "sk-or-v1-supersecretvalue123456"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OR_URL = "https://openrouter.ai/api/v1/chat/completions"


def response(status, body=None, headers=None):
    resp = MagicMock()
    resp.status_code = status
    resp.headers = headers or {}
    resp.json.return_value = body if body is not None else {}
    return resp


def call(provider, resp_or_side_effect, api_key=SECRET):
    url = GROQ_URL if provider == "groq" else OR_URL
    kwargs = (
        {"side_effect": resp_or_side_effect}
        if isinstance(resp_or_side_effect, list) or isinstance(resp_or_side_effect, Exception)
        else {"return_value": resp_or_side_effect}
    )
    with patch("requests.post", **kwargs) as post, patch("time.sleep", return_value=None):
        try:
            _invoke_chat_completion(
                api_url=url, provider=provider, api_key=api_key, model="m", prompt="hi", timeout=5
            )
        except pe.ProviderError as exc:
            return exc, post.call_count
    raise AssertionError("expected ProviderError")


@pytest.fixture(autouse=True)
def clean_registry():
    pe.reset_all()
    yield
    pe.reset_all()


def test_default_groq_quota_exhaustion_is_confirmed_and_not_retried():
    body = {"error": {"message": "You exceeded your current quota", "type": "insufficient_quota", "code": "insufficient_quota"}}
    exc, calls = call("groq", response(429, body))
    assert exc.code == pe.CODE_CREDITS and exc.provider == "groq"
    assert calls == 1


def test_openrouter_402_is_confirmed_insufficient_credits():
    exc, calls = call("openrouter", response(402, {"error": {"code": 402, "message": "Insufficient credits"}}))
    assert exc.code == pe.CODE_CREDITS and exc.provider == "openrouter"
    assert calls == 1


def test_invalid_openrouter_key_is_not_a_credit_problem():
    exc, calls = call("openrouter", response(401, {"error": {"code": 401, "message": "No auth credentials found"}}))
    assert exc.code == pe.CODE_KEY_INVALID
    assert calls == 1


def test_rate_limit_429_is_not_credit_exhaustion_even_if_message_mentions_billing():
    body = {
        "error": {
            "code": "rate_limit_exceeded",
            "message": "Rate limit reached. Upgrade at https://console.groq.com/settings/billing",
        }
    }
    exc, calls = call("groq", [response(429, body)] * 3)
    assert exc.code == pe.CODE_RATE_LIMITED
    assert calls == 3  # transient: still retried


def test_429_with_unknown_body_defaults_to_rate_limited():
    exc, _ = call("openrouter", [response(429)] * 3)
    assert exc.code == pe.CODE_RATE_LIMITED


def test_network_failure_is_temporary_and_retried():
    exc, calls = call("groq", requests.exceptions.ConnectionError("boom " + SECRET))
    assert exc.code == pe.CODE_UNAVAILABLE
    assert calls == 3
    assert SECRET not in str(exc)


def test_provider_5xx_is_temporary():
    exc, calls = call("groq", [response(503)] * 3)
    assert exc.code == pe.CODE_UNAVAILABLE and calls == 3


def test_unclassifiable_error_is_generic_not_credits():
    exc, calls = call("openrouter", response(400, {"error": {"message": "bad model"}}))
    assert exc.code == pe.CODE_OTHER and calls == 1


def test_successful_response_still_works():
    ok = response(200, {"choices": [{"message": {"content": " Hello "}}]})
    with patch("requests.post", return_value=ok):
        assert (
            _invoke_chat_completion(
                api_url=GROQ_URL, provider="groq", api_key=SECRET, model="m", prompt="hi", timeout=5
            )
            == "Hello"
        )


def test_logs_are_redacted_and_error_text_has_no_secrets(caplog):
    body = {"error": {"code": "insufficient_quota", "message": f"key {SECRET} has no credits. Bearer {SECRET}"}}
    with caplog.at_level(logging.WARNING, logger="site2chat.llm"):
        exc, _ = call("openrouter", response(402, body))
    assert caplog.records, "failure should be logged server-side"
    assert SECRET not in caplog.text
    assert SECRET not in str(exc) and "no credits" not in str(exc)


def test_registry_records_clears_and_expires():
    pe.record_issue(pe.DEFAULT_SCOPE, pe.CODE_CREDITS)
    assert pe.get_issue(pe.DEFAULT_SCOPE) == pe.CODE_CREDITS
    pe.clear_issue(pe.DEFAULT_SCOPE)
    assert pe.get_issue(pe.DEFAULT_SCOPE) is None

    pe.record_issue("owner:u1", pe.CODE_KEY_INVALID)
    with patch("rag.provider_errors.time.monotonic", return_value=10**9):
        assert pe.get_issue("owner:u1") is None  # expired


def test_registry_ignores_transient_codes():
    for code in (pe.CODE_RATE_LIMITED, pe.CODE_UNAVAILABLE, pe.CODE_OTHER):
        pe.record_issue(pe.DEFAULT_SCOPE, code)
    assert pe.get_issue(pe.DEFAULT_SCOPE) is None
