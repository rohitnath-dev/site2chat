import json
import os
import time
from collections.abc import Iterator

import requests
from dotenv import load_dotenv

from rag.provider_errors import (
    CODE_OTHER,
    CODE_UNAVAILABLE,
    RETRYABLE_CODES,
    CODE_RATE_LIMITED,
    ProviderError,
    classify,
    log_failure,
)


load_dotenv()

DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

DEFAULT_TIMEOUT = 60
MAX_TIMEOUT = 120
MAX_TOKENS = 1024


class GroqLLM:
    """Chat-completion client using the platform's Groq API key."""

    def __init__(
        self,
        model: str = DEFAULT_GROQ_MODEL,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> None:
        api_key = os.getenv("GROQ_API_KEY", "").strip()

        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is missing from the environment."
            )

        if not isinstance(model, str) or not model.strip():
            raise ValueError("A valid Groq model is required.")

        if not 1 <= timeout <= MAX_TIMEOUT:
            raise ValueError(
                f"timeout must be between 1 and {MAX_TIMEOUT} seconds."
            )

        self.api_key = api_key
        self.model = model.strip()
        self.timeout = timeout

    def invoke(self, prompt: str) -> str:
        """Send a prompt to Groq and return the generated text."""
        return _invoke_chat_completion(
            api_url=GROQ_API_URL,
            provider="groq",
            api_key=self.api_key,
            model=self.model,
            prompt=prompt,
            timeout=self.timeout,
        )

    def stream(self, prompt: str) -> Iterator[str]:
        """Yield generated text as Groq produces it."""
        return _stream_chat_completion(
            api_url=GROQ_API_URL,
            provider="groq",
            api_key=self.api_key,
            model=self.model,
            prompt=prompt,
            timeout=self.timeout,
        )


class OpenRouterLLM:
    """Chat-completion client using a customer's OpenRouter API key."""

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> None:
        if not isinstance(api_key, str) or not api_key.strip():
            raise ValueError("An OpenRouter API key is required.")

        if not isinstance(model, str) or not model.strip():
            raise ValueError("An OpenRouter model is required.")

        if not 1 <= timeout <= MAX_TIMEOUT:
            raise ValueError(
                f"timeout must be between 1 and {MAX_TIMEOUT} seconds."
            )

        self.api_key = api_key.strip()
        self.model = model.strip()
        self.timeout = timeout

    def invoke(self, prompt: str) -> str:
        """Send a prompt to OpenRouter and return the generated text."""
        return _invoke_chat_completion(
            api_url=OPENROUTER_API_URL,
            provider="openrouter",
            api_key=self.api_key,
            model=self.model,
            prompt=prompt,
            timeout=self.timeout,
        )

    def stream(self, prompt: str) -> Iterator[str]:
        """Yield generated text as OpenRouter produces it."""
        return _stream_chat_completion(
            api_url=OPENROUTER_API_URL,
            provider="openrouter",
            api_key=self.api_key,
            model=self.model,
            prompt=prompt,
            timeout=self.timeout,
        )


def _invoke_chat_completion(
    *,
    api_url: str,
    api_key: str,
    model: str,
    prompt: str,
    timeout: int,
    provider: str = "unknown",
) -> str:
    """Shared request handling. Transient failures are retried; billing and key errors are not.

    Failures raise ProviderError carrying only a safe code. Provider response bodies are logged
    (redacted) on the server and never returned to callers.
    """

    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("Prompt must be a non-empty string.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt.strip()}
        ],
        "temperature": 0.2,
        "max_tokens": MAX_TOKENS,
    }

    for attempt in range(1, 4):
        try:
            response = requests.post(
                api_url,
                headers=headers,
                json=payload,
                timeout=timeout,
            )
        except requests.exceptions.RequestException as exc:
            if attempt < 3:
                time.sleep(1.0 * attempt)
                continue
            log_failure(provider, None, CODE_UNAVAILABLE, None, api_key)
            raise ProviderError(CODE_UNAVAILABLE, provider) from exc

        http_status = response.status_code
        if isinstance(http_status, int) and http_status >= 400:
            try:
                body = response.json()
            except ValueError:
                body = None
            code = classify(http_status, body)

            # Billing (402 and confirmed quota errors) and key errors are never retried.
            retryable = code in RETRYABLE_CODES and http_status in (429, 502, 503, 504)
            if retryable and attempt < 3:
                delay = 1.0 * attempt
                if code == CODE_RATE_LIMITED:
                    delay = 1.5 * attempt
                    try:
                        header_val = float(response.headers.get("Retry-After", ""))
                        if 0 < header_val <= 10:
                            delay = header_val
                    except (ValueError, TypeError):
                        pass
                time.sleep(delay)
                continue

            log_failure(provider, http_status, code, body, api_key)
            raise ProviderError(code, provider, http_status)

        result = response.json()
        choices = result.get("choices", [])

        if not choices:
            raise RuntimeError(
                "The LLM provider returned no response choices."
            )

        content = choices[0].get("message", {}).get("content")

        if not isinstance(content, str) or not content.strip():
            raise RuntimeError(
                "The LLM provider returned an empty response."
            )

        return content.strip()

    raise ProviderError(CODE_UNAVAILABLE, provider)


def _stream_chat_completion(
    *,
    api_url: str,
    api_key: str,
    model: str,
    prompt: str,
    timeout: int,
    provider: str = "unknown",
) -> Iterator[str]:
    """Stream text deltas from an OpenAI-compatible chat-completions endpoint (server-sent events).

    Same request body as the non-streaming call plus ``stream: true``. Connection and 429/5xx errors
    are retried only before the first byte of the stream; once text has been yielded nothing is retried
    (it would duplicate output). Failures raise ProviderError with a safe code. Closing the generator
    closes the upstream connection, which stops generation on the provider side.
    """

    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("Prompt must be a non-empty string.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt.strip()}],
        "temperature": 0.2,
        "max_tokens": MAX_TOKENS,
        "stream": True,
    }

    response = None
    for attempt in range(1, 4):
        try:
            response = requests.post(
                api_url, headers=headers, json=payload, timeout=timeout, stream=True
            )
        except requests.exceptions.RequestException as exc:
            if attempt < 3:
                time.sleep(1.0 * attempt)
                continue
            log_failure(provider, None, CODE_UNAVAILABLE, None, api_key)
            raise ProviderError(CODE_UNAVAILABLE, provider) from exc

        http_status = response.status_code
        if isinstance(http_status, int) and http_status >= 400:
            try:
                body = response.json()
            except ValueError:
                body = None
            code = classify(http_status, body)
            retryable = code in RETRYABLE_CODES and http_status in (429, 502, 503, 504)
            response.close()
            if retryable and attempt < 3:
                time.sleep(1.5 * attempt if code == CODE_RATE_LIMITED else 1.0 * attempt)
                continue
            log_failure(provider, http_status, code, body, api_key)
            raise ProviderError(code, provider, http_status)
        break

    finished = False
    try:
        # iter_lines yields complete byte lines, so multi-byte UTF-8 characters are never split.
        for raw in response.iter_lines():
            if not raw:
                continue
            line = raw.decode("utf-8", errors="replace").strip()
            if not line.startswith("data:"):
                continue  # SSE comments / keep-alives such as ": OPENROUTER PROCESSING"
            data = line[5:].strip()
            if data == "[DONE]":
                finished = True
                break
            try:
                event = json.loads(data)
            except ValueError:
                continue
            if not isinstance(event, dict):
                continue
            if "error" in event:
                body = event
                code = classify(0, body)
                log_failure(provider, 200, code, body, api_key)
                raise ProviderError(code if code != CODE_OTHER else CODE_UNAVAILABLE, provider)
            choices = event.get("choices")
            if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
                continue
            delta = choices[0].get("delta")
            text = delta.get("content") if isinstance(delta, dict) else None
            if isinstance(text, str) and text:
                yield text
            if choices[0].get("finish_reason"):
                finished = True
    except requests.exceptions.RequestException as exc:
        log_failure(provider, None, CODE_UNAVAILABLE, None, api_key)
        raise ProviderError(CODE_UNAVAILABLE, provider) from exc
    finally:
        response.close()

    if not finished:
        # The connection ended without a finish marker: the answer may be cut off.
        log_failure(provider, None, CODE_UNAVAILABLE, None, api_key)
        raise ProviderError(CODE_UNAVAILABLE, provider)


def get_llm(
    provider: str | None = None,
    *,
    api_key: str | None = None,
    model: str | None = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> GroqLLM | OpenRouterLLM:
    """Create an LLM client using the selected provider and configuration."""

    selected_provider = (
        provider or os.getenv("LLM_PROVIDER", "groq")
    ).strip().lower()

    if selected_provider == "groq":
        return GroqLLM(
            model=model or DEFAULT_GROQ_MODEL,
            timeout=timeout,
        )

    if selected_provider == "openrouter":
        selected_key = (
            api_key if api_key is not None
            else os.getenv("OPENROUTER_API_KEY", "").strip()
        )
        selected_model = model or os.getenv("OPENROUTER_MODEL", "").strip()

        if not selected_key:
            raise RuntimeError("OPENROUTER_API_KEY is not configured.")

        if not selected_model:
            raise ValueError("OPENROUTER_MODEL is not configured.")

        return OpenRouterLLM(
            api_key=selected_key,
            model=selected_model,
            timeout=timeout,
        )

    raise ValueError(
        "Unsupported LLM provider. Choose 'groq' or 'openrouter'."
    )
