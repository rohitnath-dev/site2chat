import uuid
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.main import app
from database.connection import Base, get_db
from database import repository


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()



def test_chat_non_existent_bot_returns_404(client):
    res = client.post(
        "/api/v1/chat/",
        json={
            "chatbot_id": str(uuid.uuid4()),
            "message": "Hello",
        },
    )
    assert res.status_code == 404


def test_chat_unready_bot_returns_409(client, db_session):
    bot = repository.create_chatbot(
        db_session,
        name="Pending Bot",
        website_url="https://example.com",
        owner_id="u1",
    )
    # Status is default "pending"
    res = client.post(
        "/api/v1/chat/",
        json={
            "chatbot_id": str(bot.id),
            "message": "Hello",
        },
    )
    assert res.status_code == 409
    assert "not ready yet" in res.json()["detail"]


def test_chat_empty_message_rejected(client):
    res = client.post(
        "/api/v1/chat/",
        json={
            "chatbot_id": str(uuid.uuid4()),
            "message": "   ",
        },
    )
    assert res.status_code == 422


def test_chat_successful_response(client, db_session):
    bot = repository.create_chatbot(
        db_session,
        name="Ready Bot",
        website_url="https://example.com",
        owner_id="u1",
    )
    bot.status = "ready"
    db_session.commit()

    with patch("rag.rag.rag_service.answer", return_value="Our store is open from 9 AM to 6 PM."):
        res = client.post(
            "/api/v1/chat/",
            json={
                "chatbot_id": str(bot.id),
                "message": "What are your opening hours?",
                "session_id": "test-session-123",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["reply"] == "Our store is open from 9 AM to 6 PM."
        assert data["chatbot_id"] == str(bot.id)

        # Verify conversation and messages stored
        conv = repository.get_conversation_by_session(
            db_session, chatbot_id=bot.id, session_id="test-session-123"
        )
        assert conv is not None
        messages = repository.get_messages(db_session, conv.id)
        assert len(messages) == 2
        assert {m.role for m in messages} == {"user", "assistant"}
        user_msg = next(m for m in messages if m.role == "user")
        asst_msg = next(m for m in messages if m.role == "assistant")
        assert user_msg.content == "What are your opening hours?"
        assert asst_msg.content == "Our store is open from 9 AM to 6 PM."
