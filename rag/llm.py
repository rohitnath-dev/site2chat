import os

import requests
from dotenv import load_dotenv


load_dotenv()

DEFAULT_MODEL = "openai/gpt-oss-120b"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqLLM:
    """Minimal Groq chat-completion client for the Site2Chat backend."""

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        timeout: int = 60,
    ) -> None:
        api_key = os.getenv("GROQ_API_KEY", "").strip()

        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is missing from the environment."
            )

        if not 1 <= timeout <= 120:
            raise ValueError("timeout must be between 1 and 120 seconds.")

        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def invoke(self, prompt: str) -> str:
        """Send a prompt to Groq and return the generated text."""
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError("Prompt must be a non-empty string.")

        response = requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": [
                    {"role": "user", "content": prompt.strip()}
                ],
                "temperature": 0.2,
                "max_tokens": 1024,
            },
            timeout=self.timeout,
        )

        response.raise_for_status()
        result = response.json()
        choices = result.get("choices", [])

        if not choices:
            raise RuntimeError("Groq returned no response choices.")

        content = choices[0].get("message", {}).get("content")

        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Groq returned an empty response.")

        return content.strip()
