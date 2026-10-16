import uuid
import pytest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.connection import Base
from database.models import Chatbot, DocumentChunk, IngestionJob, WebsitePage
from database import repository
from rag.ingestion import ingest_website


def test_ingest_website_success_lifecycle(db_session, monkeypatch):
    bot = repository.create_chatbot(
        db_session,
        name="Lifecycle Bot",
        website_url="https://example.com/blog",
        owner_id="user_1",
    )
    job = repository.create_ingestion_job(db_session, chatbot_id=bot.id)

    fake_pages = [
        {"url": "https://example.com/blog", "title": "Blog Home", "content": "Welcome to our tech blog."},
        {"url": "https://example.com/blog/p1", "title": "Post 1", "content": "Article about scalable systems."},
    ]

    with patch("rag.ingestion.crawl_website", return_value=fake_pages):
        from rag.embeddings import embedding_service
        monkeypatch.setattr(embedding_service, "provider", "mock")

        res = ingest_website(db_session, bot.id, max_pages=10, job_id=job.id)

        assert res["status"] == "success"
        assert res["pages_saved"] == 2
        assert res["chunks_saved"] >= 2
        assert res["pages_failed"] == 0

        # Verify DB records
        updated_bot = db_session.get(Chatbot, bot.id)
        assert updated_bot.status == "ready"

        updated_job = db_session.get(IngestionJob, job.id)
        assert updated_job.status == "completed"
        assert updated_job.stage == "completed"
        assert updated_job.pages_saved == 2
        assert updated_job.completed_at is not None


def test_ingest_website_empty_content_marks_job_failed(db_session):
    bot = repository.create_chatbot(
        db_session,
        name="Empty Bot",
        website_url="https://example.com/empty",
        owner_id="user_1",
    )
    job = repository.create_ingestion_job(db_session, chatbot_id=bot.id)

    with patch("rag.ingestion.crawl_website", return_value=[]):
        with pytest.raises(ValueError, match="No usable pages were extracted"):
            ingest_website(db_session, bot.id, max_pages=10, job_id=job.id)

        updated_bot = db_session.get(Chatbot, bot.id)
        assert updated_bot.status == "failed"

        updated_job = db_session.get(IngestionJob, job.id)
        assert updated_job.status == "failed"
        assert updated_job.stage == "failed"
        assert "No usable pages" in updated_job.error_message


def test_ingest_website_crawler_exception_marks_job_failed(db_session):
    bot = repository.create_chatbot(
        db_session,
        name="Crash Bot",
        website_url="https://example.com/crash",
        owner_id="user_1",
    )
    job = repository.create_ingestion_job(db_session, chatbot_id=bot.id)

    with patch("rag.ingestion.crawl_website", side_effect=RuntimeError("DNS resolution timed out")):
        with pytest.raises(RuntimeError, match="DNS resolution timed out"):
            ingest_website(db_session, bot.id, max_pages=10, job_id=job.id)

        updated_bot = db_session.get(Chatbot, bot.id)
        assert updated_bot.status == "failed"

        updated_job = db_session.get(IngestionJob, job.id)
        assert updated_job.status == "failed"
        assert "DNS resolution timed out" in updated_job.error_message
