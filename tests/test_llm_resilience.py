import pytest
import requests
from unittest.mock import MagicMock, patch

from rag.llm import _invoke_chat_completion, get_llm, GroqLLM, OpenRouterLLM


def test_llm_empty_prompt_rejected():
    with pytest.raises(ValueError, match="Prompt must be a non-empty string"):
        _invoke_chat_completion(
            api_url="https://api.groq.com/openai/v1/chat/completions",
            api_key="test-key",
            model="openai/gpt-oss-120b",
            prompt="   ",
            timeout=10,
        )


def test_llm_successful_response():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [
            {"message": {"content": "This is a helpful assistant answer."}}
        ]
    }

    with patch("requests.post", return_value=mock_resp) as mock_post:
        ans = _invoke_chat_completion(
            api_url="https://api.groq.com/openai/v1/chat/completions",
            api_key="test-key",
            model="openai/gpt-oss-120b",
            prompt="What is this site about?",
            timeout=10,
        )
        assert ans == "This is a helpful assistant answer."
        assert mock_post.call_count == 1


def test_llm_retry_on_rate_limit_429():
    resp_429 = MagicMock()
    resp_429.status_code = 429
    resp_429.headers = {"Retry-After": "0.01"}

    resp_200 = MagicMock()
    resp_200.status_code = 200
    resp_200.json.return_value = {
        "choices": [
            {"message": {"content": "Answer after rate limit retry"}}
        ]
    }

    with patch("requests.post", side_effect=[resp_429, resp_200]) as mock_post:
        with patch("time.sleep", return_value=None):
            ans = _invoke_chat_completion(
                api_url="https://api.groq.com/openai/v1/chat/completions",
                api_key="test-key",
                model="openai/gpt-oss-120b",
                prompt="Hello",
                timeout=10,
            )
            assert ans == "Answer after rate limit retry"
            assert mock_post.call_count == 2


def test_llm_empty_choices_raises_runtime_error():
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"choices": []}

    with patch("requests.post", return_value=resp):
        with pytest.raises(RuntimeError, match="returned no response choices"):
            _invoke_chat_completion(
                api_url="https://api.groq.com/openai/v1/chat/completions",
                api_key="test-key",
                model="openai/gpt-oss-120b",
                prompt="Hello",
                timeout=10,
            )


def test_get_llm_provider_selection(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test12345")
    llm = get_llm(provider="groq")
    assert isinstance(llm, GroqLLM)
    assert llm.api_key == "gsk_test12345"

    llm_or = get_llm(provider="openrouter", api_key="sk-or-test", model="meta-llama/llama-3")
    assert isinstance(llm_or, OpenRouterLLM)
    assert llm_or.api_key == "sk-or-test"
    assert llm_or.model == "meta-llama/llama-3"
