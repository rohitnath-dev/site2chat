import os
import uuid
import pytest

from database.connection import SessionLocal
from database.models import Chatbot
from database import repository


@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="DATABASE_URL not configured")
def test_repository_manual_flow():
    db = SessionLocal()
    chatbot = None
    owner_id = f"manual-test-{uuid.uuid4().hex}"

    try:
        chatbot = repository.create_chatbot(
            db,
            name=f"Test Bot {uuid.uuid4().hex[:8]}",
            website_url="https://example.com",
            description="Temporary database test",
            owner_id=owner_id,
        )
        assert repository.get_chatbot_by_id(db, chatbot.id) is not None
        assert repository.get_chatbot(db, chatbot.id, owner_id=owner_id) is not None
        assert repository.get_chatbot(db, chatbot.id, owner_id="another-user") is None
        print("PASS: chatbot lookup and owner isolation")

        page = repository.save_page(
            db,
            chatbot_id=chatbot.id,
            url=f"https://example.com/test-{uuid.uuid4().hex[:8]}",
            title="Test Page",
            content="Temporary page content",
            status="completed",
        )
        assert page.id is not None
        assert len(repository.list_pages(db, chatbot.id)) == 1
        print("PASS: website page save and retrieve")

        conversation = repository.create_conversation(
            db, chatbot_id=chatbot.id, session_id=f"test-{uuid.uuid4().hex}"
        )
        repository.save_message(db, conversation_id=conversation.id, role="user", content="Hello")
        repository.save_message(db, conversation_id=conversation.id, role="assistant", content="Test reply")
        messages = repository.get_messages(db, conversation.id)
        assert len(messages) == 2
        assert [m.role for m in messages] == ["user", "assistant"]
        print("PASS: conversation and messages")

        chunks = repository.save_chunks(
            db,
            page_id=page.id,
            chunks=[
                {"chunk_index": 0, "content": "Temporary chunk one", "embedding": None},
                {"chunk_index": 1, "content": "Temporary chunk two", "embedding": None},
            ],
        )
        assert len(chunks) == 2
        assert len(repository.list_conversations(db, chatbot.id)) == 1
        print("PASS: chunks and conversation listing")
    finally:
        if chatbot is not None:
            try:
                existing = db.get(Chatbot, chatbot.id)
                if existing is not None:
                    db.delete(existing)
                    db.commit()
                print("Cleanup: temporary records removed")
            except Exception:
                db.rollback()
                print("WARNING: cleanup failed; inspect the test records manually")
        db.close()


if __name__ == "__main__":
    run_test()
