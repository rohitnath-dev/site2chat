import os

import requests
from dotenv import load_dotenv


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
) -> str:
    """Shared request and response handling for both providers."""

    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("Prompt must be a non-empty string.")

    response = requests.post(
        api_url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "user", "content": prompt.strip()}
            ],
            "temperature": 0.2,
            "max_tokens": MAX_TOKENS,
        },
        timeout=timeout,
    )

    response.raise_for_status()

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


def get_llm(
    provider: str | None = None,
    *,
    api_key: str | None = None,
    model: str | None = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> GroqLLM | OpenRouterLLM:
    """Create an LLM client for the requested provider.

    Groq is the default. OpenRouter requires an explicit API key
    and model supplied by the backend.
    """

    selected_provider = (
        provider or os.getenv("LLM_PROVIDER", "groq")
    ).strip().lower()

    if selected_provider == "groq":
        return GroqLLM(
            model=model or DEFAULT_GROQ_MODEL,
            timeout=timeout,
        )

    if selected_provider == "openrouter":
        if not api_key:
            raise ValueError(
                "An OpenRouter API key must be configured."
            )

        if not model:
            raise ValueError(
                "An OpenRouter model must be selected."
            )

        return OpenRouterLLM(
            api_key=api_key,
            model=model,
            timeout=timeout,
        )

    raise ValueError(
        "Unsupported LLM provider. Choose 'groq' or 'openrouter'."
    )
