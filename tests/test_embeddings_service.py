import pytest
from rag.embeddings import EmbeddingService, EMBEDDING_DIM, _deterministic_mock_embedding


def test_deterministic_mock_embedding_dimensions():
    vec = _deterministic_mock_embedding("Hello world")
    assert len(vec) == EMBEDDING_DIM
    assert all(isinstance(x, float) for x in vec)

    # Determinism: same input produces exact same vector
    vec2 = _deterministic_mock_embedding("Hello world")
    assert vec == vec2

    # Different inputs produce different vectors
    vec_diff = _deterministic_mock_embedding("Different website text")
    assert vec != vec_diff


def test_embedding_service_chunk_documents():
    service = EmbeddingService(chunk_size=100, chunk_overlap=20)
    docs = [
        {"url": "https://example.com/p1", "title": "Page 1", "content": "This is a sentence. " * 20},
        {"url": "https://example.com/p2", "title": "Page 2", "content": "Short content"},
        {"url": "https://example.com/p3", "title": "Page 3", "content": ""},  # empty should be skipped
    ]

    chunks = service.chunk_documents(docs)
    assert len(chunks) > 1
    # Metadata preserved
    assert chunks[0]["metadata"]["url"] == "https://example.com/p1"
    assert chunks[0]["metadata"]["title"] == "Page 1"
    assert chunks[0]["metadata"]["chunk_index"] == 0
    # Text non-empty
    assert all(c["text"].strip() for c in chunks)


def test_embedding_service_embed_texts_validation():
    service = EmbeddingService()
    # Empty list
    assert service.embed_texts([]) == []

    # Invalid batch_size
    with pytest.raises(ValueError, match="batch_size must be positive"):
        service.embed_texts(["test"], batch_size=0)

    # Empty string inside list
    with pytest.raises(ValueError, match="Every text must be a non-empty string"):
        service.embed_texts(["valid", "   "])


def test_embedding_service_embed_documents_mock():
    service = EmbeddingService(chunk_size=200, chunk_overlap=50)
    service.provider = "mock"

    docs = [
        {"url": "https://example.com/about", "title": "About Us", "content": "We build fast software for websites."},
    ]
    embedded = service.embed_documents(docs)
    assert len(embedded) == 1
    assert "embedding" in embedded[0]
    assert len(embedded[0]["embedding"]) == 384

def test_huggingface_request_failure_raises_in_production(monkeypatch):
    service = EmbeddingService()
    service.hf_token = "hf-test-token"
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setattr("rag.embeddings.time.sleep", lambda *_: None)

    def fail_request(*args, **kwargs):
        raise RuntimeError("network unavailable")

    monkeypatch.setattr("rag.embeddings.requests.post", fail_request)
    with pytest.raises(RuntimeError, match="Hugging Face embedding inference failed"):
        service._embed_huggingface(["example text"])


def test_huggingface_invalid_response_raises_in_production(monkeypatch):
    class BadResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"error": "unexpected payload"}

    service = EmbeddingService()
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setattr("rag.embeddings.time.sleep", lambda *_: None)
    monkeypatch.setattr(
        "rag.embeddings.requests.post", lambda *args, **kwargs: BadResponse()
    )

    with pytest.raises(RuntimeError, match="unexpected embedding response"):
        service._embed_huggingface(["example text"])
