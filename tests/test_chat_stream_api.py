"""POST /chat/stream: event format, persistence, errors and disconnect handling."""

import json
import uuid
from contextlib import contextmanager
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app
from database import repository
from database.connection import get_db
from rag import provider_errors as pe
from rag.rag import NO_CONTEXT_REPLY, RAGService


@pytest.fixture()
def client(db_session, monkeypatch):
    def override_db():
        yield db_session

    @contextmanager
    def shared_session():
        yield db_session  # the test session must stay open for assertions

    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr("api.chat.open_session", shared_session)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def ready_bot(db):
    bot = repository.create_chatbot(db, name="Bot", website_url="https://example.com", owner_id="o1")
    bot.status = "ready"
    db.commit()
    return bot


def events(res):
    out = []
    for block in res.text.split("\n\n"):
        if not block.strip():
            continue
        lines = dict(line.split(": ", 1) for line in block.split("\n"))
        out.append((lines["event"], json.loads(lines["data"])))
    return out


def post(client, bot, message="Hours?", session="s1"):
    return client.post(
        "/api/v1/chat/stream",
        json={"chatbot_id": str(bot.id), "message": message, "session_id": session},
    )


def fake_pipeline(items, error=None):
    def gen(db, **kwargs):
        yield from items
        if error:
            raise error

    return gen


def messages_for(db, bot, session="s1"):
    conv = repository.get_conversation_by_session(db, chatbot_id=bot.id, session_id=session)
    return repository.get_messages(db, conv.id)


def test_streams_status_then_text_then_done_and_saves_once(client, db_session):
    bot = ready_bot(db_session)
    items = [("status", "searching"), ("status", "preparing"), ("delta", "We open "), ("delta", "at 9.")]
    with patch("rag.rag.rag_service.stream_answer", fake_pipeline(items)):
        res = post(client, bot)
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/event-stream")
    ev = events(res)
    assert [e for e, _ in ev] == ["status", "status", "delta", "delta", "done"]
    assert "".join(d["text"] for e, d in ev if e == "delta") == "We open at 9."
    saved = messages_for(db_session, bot)
    assert [(m.role, m.content) for m in saved] == [("user", "Hours?"), ("assistant", "We open at 9.")]


def test_sequential_messages_do_not_duplicate_text(client, db_session):
    bot = ready_bot(db_session)
    for text in ("One.", "Two."):
        with patch("rag.rag.rag_service.stream_answer", fake_pipeline([("delta", text)])):
            post(client, bot, message=text)
    contents = [m.content for m in messages_for(db_session, bot) if m.role == "assistant"]
    assert contents == ["One.", "Two."]


def test_pre_stream_errors_keep_existing_status_codes(client, db_session):
    assert client.post("/api/v1/chat/stream", json={"chatbot_id": str(uuid.uuid4()), "message": "x"}).status_code == 404
    pending = repository.create_chatbot(db_session, name="P", website_url="https://e.com", owner_id="o")
    assert post(client, pending).status_code == 409
    assert client.post("/api/v1/chat/stream", json={"chatbot_id": str(pending.id), "message": "  "}).status_code == 422


def test_provider_failure_becomes_a_safe_error_event_and_saves_no_reply(client, db_session):
    bot = ready_bot(db_session)
    err = pe.ProviderError(pe.CODE_CREDITS, "groq", 402)
    with patch("rag.rag.rag_service.stream_answer", fake_pipeline([("status", "preparing")], error=err)):
        res = post(client, bot)
    ev = events(res)
    assert ev[-1][0] == "error"
    assert ev[-1][1] == {
        "detail": "This chatbot is temporarily unable to respond. Please try again later.",
        "code": "chatbot_unavailable",
    }
    assert "groq" not in res.text.lower() and "402" not in res.text
    assert [m.role for m in messages_for(db_session, bot)] == ["user"]


def test_interrupted_stream_reports_error_after_partial_text(client, db_session):
    bot = ready_bot(db_session)
    err = pe.ProviderError(pe.CODE_UNAVAILABLE, "groq")
    with patch("rag.rag.rag_service.stream_answer", fake_pipeline([("delta", "Part")], error=err)):
        ev = events(post(client, bot))
    assert [e for e, _ in ev] == ["delta", "error"] and ev[-1][1]["code"] == "chatbot_error"
    assert [m.role for m in messages_for(db_session, bot)] == ["user"]


def test_empty_stream_is_an_error_not_a_blank_reply(client, db_session):
    bot = ready_bot(db_session)
    with patch("rag.rag.rag_service.stream_answer", fake_pipeline([("status", "searching")])):
        ev = events(post(client, bot))
    assert ev[-1][0] == "error"
    assert [m.role for m in messages_for(db_session, bot)] == ["user"]


def test_unexpected_exception_does_not_leak_details(client, db_session):
    bot = ready_bot(db_session)
    with patch("rag.rag.rag_service.stream_answer", fake_pipeline([], error=KeyError("secret-internal"))):
        res = post(client, bot)
    assert "secret-internal" not in res.text and events(res)[-1][0] == "error"


def test_non_streaming_endpoint_is_unchanged(client, db_session):
    bot = ready_bot(db_session)
    with patch("rag.rag.rag_service.answer", return_value="Plain."):
        res = client.post("/api/v1/chat/", json={"chatbot_id": str(bot.id), "message": "Hi"})
    assert res.status_code == 200 and res.json()["reply"] == "Plain."


class StreamingFake:
    def __init__(self, pieces, closed):
        self.pieces, self.closed = pieces, closed

    def stream(self, prompt):
        try:
            yield from self.pieces
        finally:
            self.closed.append(True)


def test_rag_stream_reports_real_stages_in_order(db_session):
    bot = ready_bot(db_session)
    closed = []
    chunk = type("C", (), {"content": "Opening hours 9-5"})()
    with patch("rag.rag.embedding_service.embed_texts", return_value=[[0.1]]), patch(
        "rag.rag.repository.search_chunks", return_value=[chunk]
    ):
        out = list(RAGService(llm=StreamingFake(["A", "B"], closed)).stream_answer(db_session, chatbot_id=bot.id, question="Hours?"))
    assert out == [("status", "searching"), ("status", "preparing"), ("delta", "A"), ("delta", "B")]
    assert closed == [True]


def test_rag_stream_without_context_skips_the_model(db_session):
    bot = ready_bot(db_session)
    with patch("rag.rag.embedding_service.embed_texts", return_value=[[0.1]]), patch(
        "rag.rag.repository.search_chunks", return_value=[]
    ):
        out = list(RAGService(llm=StreamingFake(["never"], [])).stream_answer(db_session, chatbot_id=bot.id, question="Hours?"))
    assert out == [("status", "searching"), ("delta", NO_CONTEXT_REPLY)]


def test_closing_the_rag_stream_closes_the_model_stream(db_session):
    bot = ready_bot(db_session)
    closed = []
    chunk = type("C", (), {"content": "ctx"})()
    with patch("rag.rag.embedding_service.embed_texts", return_value=[[0.1]]), patch(
        "rag.rag.repository.search_chunks", return_value=[chunk]
    ):
        gen = RAGService(llm=StreamingFake(["A", "B", "C"], closed)).stream_answer(db_session, chatbot_id=bot.id, question="Hours?")
        for item in gen:
            if item[0] == "delta":
                break
        gen.close()
    assert closed == [True]
