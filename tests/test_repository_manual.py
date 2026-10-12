import uuid

from sqlalchemy import select

from database.connection import SessionLocal
from database.models import (
    Chatbot,
    WebsitePage,
    Conversation,
    Message,
    DocumentChunk,
)
from database import repository


def run_test():
    db = SessionLocal()
    chatbot = None

    try:
        # 1. Create and retrieve a chatbot
        unique_name = f"Test Bot {uuid.uuid4().hex[:8]}"

        chatbot = repository.create_chatbot(
            db,
            name=unique_name,
            website_url="https://example.com",
            description="Temporary database test",
        )

        assert repository.get_chatbot(db, chatbot.id) is not None
        assert (
            repository.get_chatbot_by_public_id(
                db, chatbot.public_id
            )
            is not None
        )
        print("PASS: Chatbot create and retrieve")

        # 2. Save and retrieve a website page
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
        print("PASS: Website page save and retrieve")

        # 3. Create a conversation
        conversation = repository.create_conversation(
            db,
            chatbot_id=chatbot.id,
            session_id=f"test-{uuid.uuid4().hex}",
        )

        assert conversation.id is not None
        print("PASS: Conversation create")

        # 4. Save and retrieve messages
        repository.save_message(
            db,
            conversation_id=conversation.id,
            role="user",
            content="Hello",
        )

        repository.save_message(
            db,
            conversation_id=conversation.id,
            role="assistant",
            content="Test reply",
        )

        messages = repository.get_messages(db, conversation.id)
        assert len(messages) == 2
        assert messages[0].role == "user"
        assert messages[1].role == "assistant"
        print("PASS: Messages save and retrieve")

        # 5. Save chunks (embedding omitted for this test)
        chunks = repository.save_chunks(
            db,
            page_id=page.id,
            chunks=[
                {
                    "chunk_index": 0,
                    "content": "Temporary chunk one",
                    "embedding": None,
                },
                {
                    "chunk_index": 1,
                    "content": "Temporary chunk two",
                    "embedding": None,
                },
            ],
        )

        assert len(chunks) == 2
        print("PASS: Document chunks save")

        # 6. Verify chatbot conversations
        conversations = repository.list_conversations(
            db, chatbot.id
        )
        assert len(conversations) == 1
        print("PASS: Conversation listing")

        print("\nAll repository tests passed.")

    finally:
        # Remove only the temporary chatbot and its related records.
        if chatbot is not None:
            try:
                existing = db.get(Chatbot, chatbot.id)
                if existing is not None:
                    db.delete(existing)
                    db.commit()
                print("Cleanup: Temporary test records removed.")
            except Exception:
                db.rollback()
                print(
                    "WARNING: Cleanup failed. "
                    "Check Supabase before rerunning."
                )
        db.close()


if __name__ == "__main__":
    run_test()
