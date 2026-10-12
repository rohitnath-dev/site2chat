
from typing import Any

from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer


DEFAULT_CHUNK_SIZE = 1000
DEFAULT_CHUNK_OVERLAP = 150
DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


class EmbeddingService:
    """Split website documents into chunks and generate embeddings."""

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
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        self.model: SentenceTransformer | None = None

    def load_model(self) -> None:
        """Load the embedding model when it is first needed."""
        if self.model is None:
            self.model = SentenceTransformer(self.model_name)

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

    def embed_texts(
        self,
        texts: list[str],
        batch_size: int = 32,
    ) -> list[list[float]]:
        """Convert text strings into embedding vectors."""
        if batch_size < 1:
            raise ValueError("batch_size must be positive.")

        if not texts:
            return []

        if any(not isinstance(text, str) or not text.strip() for text in texts):
            raise ValueError("Every text must be a non-empty string.")

        self.load_model()

        vectors = self.model.encode(
            texts,
            batch_size=batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        return vectors.tolist()

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