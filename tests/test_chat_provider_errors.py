"""API behaviour for provider failures: safe visitor messages, owner status, and recovery."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from api.main import app
from core.auth import get_current_user
from database import repository
from database.connection import get_db
from rag import provider_errors as pe
from rag.rag import RAGService

OWNER = "owner_1"
VISITOR_MESSAGE = "This chatbot is temporarily unable to respond. Please try again later."
LEAKS = ("sk-or-v1-secret", "insufficient_quota", "Insufficient credits", "Traceback", "api.groq.com", "openrouter.ai")


@pytest.fixture(autouse=True)
def clean_registry():
    pe.reset_all()
    yield
    pe.reset_all()


@pytest.fixture()
def client(db_session):
    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: {"sub": OWNER}
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def make_bot(db, provider="groq"):
    bot = repository.create_chatbot(db, name="Bot", website_url="https://example.com", owner_id=OWNER)
    bot.status = "ready"
    bot.llm_provider = provider
    db.commit()
    return bot


def chat(client, bot):
    return client.post("/api/v1/chat/", json={"chatbot_id": str(bot.id), "message": "Hi"})


@pytest.mark.parametrize("code", [pe.CODE_CREDITS, pe.CODE_KEY_INVALID])
def test_visitor_gets_only_the_safe_message(client, db_session, code):
    bot = make_bot(db_session)
    err = pe.ProviderError(code, "groq", 402)
    with patch("rag.rag.rag_service.answer", side_effect=err):
        res = chat(client, bot)
    assert res.status_code == 503
    assert res.json() == {"detail": VISITOR_MESSAGE, "code": "chatbot_unavailable"}
    for leak in LEAKS:
        assert leak not in res.text


def test_rate_limit_and_temporary_failures_are_not_reported_as_credit_problems(client, db_session):
    bot = make_bot(db_session)
    with patch("rag.rag.rag_service.answer", side_effect=pe.ProviderError(pe.CODE_RATE_LIMITED, "groq", 429)):
        busy = chat(client, bot)
    with patch("rag.rag.rag_service.answer", side_effect=pe.ProviderError(pe.CODE_UNAVAILABLE, "groq")):
        down = chat(client, bot)
    assert busy.json()["code"] == "chatbot_busy"
    assert down.status_code == 502 and down.json()["code"] == "chatbot_error"
    assert VISITOR_MESSAGE not in busy.text + down.text


def test_successful_chat_still_works(client, db_session):
    bot = make_bot(db_session)
    with patch("rag.rag.rag_service.answer", return_value="We open at 9."):
        res = chat(client, bot)
    assert res.status_code == 200 and res.json()["reply"] == "We open at 9."


class FakeLLM:
    def __init__(self, error=None):
        self.error = error

    def invoke(self, prompt):
        if self.error:
            raise self.error
        return "An answer."


def answer_with(db, bot, llm):
    chunk = type("C", (), {"content": "Opening hours 9-5"})()
    with patch("rag.rag.embedding_service.embed_texts", return_value=[[0.1]]), patch(
        "rag.rag.repository.search_chunks", return_value=[chunk]
    ):
        return RAGService(llm=llm).answer(db, chatbot_id=bot.id, question="Hours?")


def status(client):
    return client.get("/api/v1/chatbots/credentials/ai-status").json()


def test_default_provider_credit_exhaustion_is_reported_to_owner_then_clears(client, db_session):
    bot = make_bot(db_session, "groq")
    with pytest.raises(pe.ProviderError):
        answer_with(db_session, bot, FakeLLM(pe.ProviderError(pe.CODE_CREDITS, "groq", 429)))
    assert status(client)["default_provider"]["status"] == "credits_exhausted"
    assert status(client)["own_openrouter"]["status"] == "ok"

    # Provider works again -> warning clears.
    assert answer_with(db_session, bot, FakeLLM()) == "An answer."
    assert status(client)["default_provider"]["status"] == "ok"


def test_owner_openrouter_credit_problem_is_separate_from_the_default_provider(client, db_session):
    bot = make_bot(db_session, "openrouter")
    with patch("rag.rag.repository.get_user_openrouter_key", return_value="enc"), patch(
        "rag.rag.decrypt_secret", return_value="sk-or-v1-secret"
    ), patch("rag.rag.get_llm", return_value=FakeLLM(pe.ProviderError(pe.CODE_CREDITS, "openrouter", 402))):
        with pytest.raises(pe.ProviderError):
            answer_with(db_session, bot, None)
    body = status(client)
    assert body["own_openrouter"]["status"] == "credits_exhausted"
    assert body["default_provider"]["status"] == "ok"


def test_invalid_owner_key_is_reported_as_key_problem(client, db_session):
    bot = make_bot(db_session, "openrouter")
    with patch("rag.rag.repository.get_user_openrouter_key", return_value="enc"), patch(
        "rag.rag.decrypt_secret", return_value="sk-or-v1-secret"
    ), patch("rag.rag.get_llm", return_value=FakeLLM(pe.ProviderError(pe.CODE_KEY_INVALID, "openrouter", 401))):
        with pytest.raises(pe.ProviderError):
            answer_with(db_session, bot, None)
    assert status(client)["own_openrouter"]["status"] == "key_invalid"


def test_saving_a_new_key_clears_the_owner_warning(client):
    pe.record_issue(pe.owner_scope(OWNER), pe.CODE_CREDITS)
    assert status(client)["own_openrouter"]["status"] == "credits_exhausted"
    with patch("api.chatbots.encrypt_secret", return_value="enc"):
        res = client.put("/api/v1/chatbots/credentials/openrouter", json={"api_key": "sk-or-v1-newkeyvalue"})
    assert res.status_code == 204
    assert status(client)["own_openrouter"]["status"] == "ok"


def test_rate_limit_does_not_create_a_warning(client, db_session):
    bot = make_bot(db_session)
    with pytest.raises(pe.ProviderError):
        answer_with(db_session, bot, FakeLLM(pe.ProviderError(pe.CODE_RATE_LIMITED, "groq", 429)))
    assert status(client)["default_provider"]["status"] == "ok"


def test_chatbot_list_exposes_provider_so_the_dashboard_can_pick_the_right_warning(client, db_session):
    make_bot(db_session, "openrouter")
    bots = client.get("/api/v1/chatbots/").json()["chatbots"]
    assert bots[0]["llm_provider"] == "openrouter"
