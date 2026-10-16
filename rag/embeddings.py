
import hashlib
import logging
import math
import os
import time
from typing import Any

from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
import requests

load_dotenv()

logger = logging.getLogger("site2chat.embeddings")

DEFAULT_CHUNK_SIZE = 1000
DEFAULT_CHUNK_OVERLAP = 150
DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

HF_INFERENCE_URL = (
    "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction"
)
OPENROUTER_EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings"
OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings"


def _deterministic_mock_embedding(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Generate a deterministic unit-normalized vector for testing or offline environments."""
    values = []
    text_bytes = text.strip().encode("utf-8")
    for i in range(dim):
        # Mix byte hash with dimension index to produce pseudo-random but repeatable floats
        h = hashlib.sha256(text_bytes + str(i).encode("ascii")).digest()
        int_val = int.from_bytes(h[:4], "little", signed=True)
        values.append(int_val / (2**31))

    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [round(v / norm, 6) for v in values]


class EmbeddingService:
    """Split website documents into chunks and generate 384-dimensional embeddings via cloud APIs."""

    def __init__(
        self,
        model_name: str = DEFAULT_EMBEDDING_MODEL,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
    ) -> None:
        if chunk_size < 1:
            raise ValueError("chunk_size must be positive.")

        if chunk_overlap < 0 or chunk_overlap >= chunk_size:
            raise ValueError(
                "chunk_overlap must be non-negative and smaller than chunk_size."
            )

        self.model_name = model_name
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        self.provider = os.getenv("EMBEDDING_PROVIDER", "huggingface").strip().lower()
        self.hf_token = os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_TOKEN") or ""
        self.openai_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY") or ""
        self.timeout = int(os.getenv("EMBEDDING_TIMEOUT", "30"))

    def load_model(self) -> None:
        """Compatibility hook: ensure configuration is loaded without local weight allocation."""
        pass

    def chunk_documents(
        self,
        documents: list[dict[str, str]],
    ) -> list[dict[str, Any]]:
        """Split documents while preserving source metadata."""
        chunks: list[dict[str, Any]] = []

        for document in documents:
            content = document.get("content", "").strip()

            if not content:
                continue

            metadata = {
                "url": document.get("url", ""),
                "title": document.get("title", "Untitled page"),
            }

            text_chunks = self.splitter.split_text(content)

            for index, text in enumerate(text_chunks):
                chunks.append({
                    "text": text,
                    "metadata": {
                        **metadata,
                        "chunk_index": index,
                    },
                })

        return chunks

    def _embed_huggingface(self, texts: list[str]) -> list[list[float]]:
        """Request embeddings from Hugging Face Serverless Inference API."""
        headers = {"Content-Type": "application/json"}
        if self.hf_token:
            headers["Authorization"] = f"Bearer {self.hf_token}"

        payload = {
            "inputs": texts,
            "options": {"wait_for_model": True, "use_cache": True},
        }

        # Try main router URL, with fallback to legacy api-inference URL
        urls = [
            HF_INFERENCE_URL,
            "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
        ]

        last_error = None
        for url in urls:
            for attempt in range(3):
                try:
                    resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
                    if resp.status_code == 503 and attempt < 2:
                        # Model is loading on Hugging Face; back off and retry
                        time.sleep(2.0 * (attempt + 1))
                        continue
                    if resp.status_code == 429 and attempt < 2:
                        time.sleep(1.5 * (attempt + 1))
                        continue
                    resp.raise_for_status()
                    data = resp.json()

                    # Hugging Face feature extraction returns either list of vectors or nested lists
                    if isinstance(data, list) and len(data) == len(texts):
                        vectors = []
                        for item in data:
                            if isinstance(item, list):
                                # If pooled sentence embedding: length 384
                                if len(item) == EMBEDDING_DIM:
                                    vectors.append(item)
                                elif len(item) > 0 and isinstance(item[0], list):
                                    # Mean pooling across tokens if token-level output was returned
                                    token_count = len(item)
                                    vec = [
                                        sum(tok[k] for tok in item) / token_count
                                        for k in range(len(item[0]))
                                    ]
                                    vectors.append(vec[:EMBEDDING_DIM])
                        if len(vectors) == len(texts):
                            return vectors
                except Exception as exc:
                    last_error = exc
                    logger.warning("HF endpoint %s failed (attempt %s): %s", url, attempt + 1, exc)
                    if attempt < 2:
                        time.sleep(1.0)
                        continue

        is_test = os.getenv("ENVIRONMENT", "").strip().lower() == "test"
        if last_error:
            logger.warning("HF Inference embedding call failed: %s", last_error)
            if is_test:
                return [_deterministic_mock_embedding(t) for t in texts]
            raise RuntimeError(f"Hugging Face embedding inference failed: {last_error}") from last_error

        if is_test:
            return [_deterministic_mock_embedding(t) for t in texts]
        raise RuntimeError("Hugging Face returned an unexpected embedding response.")

    def _embed_openai_compatible(self, texts: list[str]) -> list[list[float]]:
        """Request 384-dimensional embeddings from OpenAI or OpenRouter."""
        is_openrouter = self.provider == "openrouter"
        api_url = OPENROUTER_EMBEDDING_URL if is_openrouter else OPENAI_EMBEDDING_URL
        api_key = self.openai_key

        if not api_key:
            if os.getenv("ENVIRONMENT") == "test":
                return [_deterministic_mock_embedding(t) for t in texts]
            raise RuntimeError("API key is not configured for cloud embeddings.")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        model = (
            "openai/text-embedding-3-small"
            if is_openrouter
            else "text-embedding-3-small"
        )
        payload = {
            "model": model,
            "input": texts,
            "dimensions": EMBEDDING_DIM,
        }

        resp = requests.post(api_url, headers=headers, json=payload, timeout=self.timeout)
        resp.raise_for_status()
        result = resp.json()
        data = sorted(result.get("data", []), key=lambda x: x.get("index", 0))
        vectors = [item["embedding"] for item in data]
        if len(vectors) != len(texts):
            raise RuntimeError("Embedding response item count does not match input.")
        return vectors

    def embed_texts(
        self,
        texts: list[str],
        batch_size: int = 32,
    ) -> list[list[float]]:
        """Convert text strings into 384-dimensional embedding vectors."""
        if batch_size < 1:
            raise ValueError("batch_size must be positive.")

        if not texts:
            return []

        if any(not isinstance(text, str) or not text.strip() for text in texts):
            raise ValueError("Every text must be a non-empty string.")

        all_vectors: list[list[float]] = []

        # Process in bounded batches to conserve network buffers and avoid payload size limits
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            if self.provider in ("openai", "openrouter"):
                vectors = self._embed_openai_compatible(batch)
            elif self.provider == "mock":
                vectors = [_deterministic_mock_embedding(t) for t in batch]
            else:
                vectors = self._embed_huggingface(batch)

            # Validate dimensions strictly
            for v in vectors:
                if len(v) != EMBEDDING_DIM:
                    raise ValueError(f"Embedding dimension must be {EMBEDDING_DIM}, got {len(v)}.")

            all_vectors.extend(vectors)

        return all_vectors

    def embed_documents(
        self,
        documents: list[dict[str, str]],
        batch_size: int = 32,
    ) -> list[dict[str, Any]]:
        """Chunk documents and attach an embedding vector to each chunk."""
        chunks = self.chunk_documents(documents)

        if not chunks:
            return []

        vectors = self.embed_texts(
            [chunk["text"] for chunk in chunks],
            batch_size=batch_size,
        )

        for chunk, vector in zip(chunks, vectors):
            chunk["embedding"] = vector

        return chunks


embedding_service = EmbeddingService()
