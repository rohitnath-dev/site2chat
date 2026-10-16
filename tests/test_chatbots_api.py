import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.main import app
from core.auth import get_current_user
from database.connection import Base, get_db
from database.models import Chatbot, IngestionJob





@pytest.fixture()
def client(db_session, monkeypatch):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        return {"sub": "user_123", "email": "test@example.com"}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    # Mock crawler address resolution so validate_website_url doesn't do real DNS in test
    from rag import crawler
    monkeypatch.setattr(crawler, "_validate_public_target", lambda h, p: None)

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_create_chatbot_and_list(client):
    res = client.post(
        "/api/v1/chatbots/",
        json={"name": "My Docs Bot", "website_url": "https://example.com/docs"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "My Docs Bot"
    assert data["status"] == "pending"
    bot_id = data["id"]

    # List chatbots
    list_res = client.get("/api/v1/chatbots/")
    assert list_res.status_code == 200
    bots = list_res.json()["chatbots"]
    assert len(bots) == 1
    assert bots[0]["id"] == bot_id


def test_create_chatbot_duplicate_reuse(client):
    res1 = client.post(
        "/api/v1/chatbots/",
        json={"name": "First Bot", "website_url": "https://example.com/blog"},
    )
    assert res1.status_code == 201
    bot1_id = res1.json()["id"]

    # Re-submitting the same URL while pending reuses the existing bot record instead of creating duplicates
    res2 = client.post(
        "/api/v1/chatbots/",
        json={"name": "First Bot Retry", "website_url": "https://example.com/blog"},
    )
    assert res2.status_code == 201
    assert res2.json()["id"] == bot1_id


def test_chatbot_owner_isolation(client):
    res = client.post(
        "/api/v1/chatbots/",
        json={"name": "User 1 Bot", "website_url": "https://example.com/app"},
    )
    bot_id = res.json()["id"]

    # Switch user to user_other
    app.dependency_overrides[get_current_user] = lambda: {"sub": "user_other"}

    get_res = client.get(f"/api/v1/chatbots/{bot_id}")
    assert get_res.status_code == 404

    del_res = client.delete(f"/api/v1/chatbots/{bot_id}")
    assert del_res.status_code == 404


def test_ingest_trigger_and_status_polling(client, db_session, monkeypatch):
    from unittest.mock import patch

    res = client.post(
        "/api/v1/chatbots/",
        json={"name": "Ingest Test Bot", "website_url": "https://example.com/site"},
    )
    bot_id = res.json()["id"]

    # Trigger async ingestion
    with patch("api.chatbots.run_background_ingest") as mock_worker:
        ingest_res = client.post(f"/api/v1/chatbots/{bot_id}/ingest")
        assert ingest_res.status_code == 200
        job_data = ingest_res.json()
        assert job_data["status"] == "queued"
        assert "job_id" in job_data
        assert job_data["chatbot_id"] == bot_id

        # Polling status endpoint
        status_res = client.get(f"/api/v1/chatbots/{bot_id}/ingest/status")
        assert status_res.status_code == 200
        poll_data = status_res.json()
        assert poll_data["status"] == "queued"
        assert poll_data["job_id"] == job_data["job_id"]

        # Duplicate ingest call returns the active job
        dup_res = client.post(f"/api/v1/chatbots/{bot_id}/ingest")
        assert dup_res.status_code == 200
        assert dup_res.json()["job_id"] == job_data["job_id"]
