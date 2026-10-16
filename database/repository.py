from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from database.models import (
    UserLLMCredential,
    Chatbot,
    WebsitePage,
    Conversation,
    Message,
    DocumentChunk,
    IngestionJob,
)


# -------------------------
# CHATBOTS
# -------------------------

def create_chatbot(
    db: Session,
    *,
    name: str,
    website_url: str,
    owner_id: str,
    description: str | None = None,
) -> Chatbot:
    chatbot = Chatbot(
        name=name,
        website_url=website_url,
        owner_id=owner_id,
        description=description,
    )
    db.add(chatbot)
    db.commit()
    db.refresh(chatbot)
    return chatbot


def get_chatbot(
    db: Session,
    chatbot_id: UUID,
    *,
    owner_id: str,
) -> Chatbot | None:
    """Get a chatbot only when it belongs to the supplied owner."""
    statement = select(Chatbot).where(
        Chatbot.id == chatbot_id,
        Chatbot.owner_id == owner_id,
    )
    return db.scalar(statement)


def get_chatbot_by_id(db: Session, chatbot_id: UUID) -> Chatbot | None:
    """Internal lookup for flows intentionally addressed by internal UUID."""
    return db.scalar(select(Chatbot).where(Chatbot.id == chatbot_id))

def update_chatbot_llm_settings(
    db: Session,
    chatbot_id: UUID,
    *,
    owner_id: str,
    llm_provider: str,
    llm_model: str,
) -> Chatbot | None:
    statement = select(Chatbot).where(
        Chatbot.id == chatbot_id,
        Chatbot.owner_id == owner_id,
    )
    chatbot = db.scalar(statement)
    if chatbot is None:
        return None

    chatbot.llm_provider = llm_provider
    chatbot.llm_model = llm_model
    db.commit()
    db.refresh(chatbot)
    return chatbot

def get_chatbot_by_public_id(
    db: Session, public_id: str
) -> Chatbot | None:
    statement = select(Chatbot).where(
        Chatbot.public_id == public_id
    )
    return db.scalar(statement)


def list_chatbots(
    db: Session,
    *,
    owner_id: str,
    limit: int = 50,
    offset: int = 0,
) -> list[Chatbot]:
    statement = (
        select(Chatbot)
        .where(Chatbot.owner_id == owner_id)
        .order_by(Chatbot.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(statement).all())


def delete_chatbot(
    db: Session, chatbot_id: UUID, *, owner_id: str
) -> bool:
    statement = select(Chatbot).where(
        Chatbot.id == chatbot_id,
        Chatbot.owner_id == owner_id,
    )
    chatbot = db.scalar(statement)

    if chatbot is None:
        return False

    db.delete(chatbot)
    db.commit()
    return True


# -------------------------
# WEBSITE PAGES
# -------------------------

def save_page(
    db: Session,
    *,
    chatbot_id: UUID,
    url: str,
    content: str,
    title: str | None = None,
    status: str = "pending",
) -> WebsitePage:
    page = WebsitePage(
        chatbot_id=chatbot_id,
        url=url,
        content=content,
        title=title,
        status=status,
    )
    db.add(page)

    try:
        db.commit()
        db.refresh(page)
    except Exception:
        db.rollback()
        raise

    return page


def get_page(db: Session, page_id: UUID) -> WebsitePage | None:
    return db.get(WebsitePage, page_id)


def list_pages(
    db: Session, chatbot_id: UUID
) -> list[WebsitePage]:
    statement = (
        select(WebsitePage)
        .where(WebsitePage.chatbot_id == chatbot_id)
        .order_by(WebsitePage.created_at.asc())
    )
    return list(db.scalars(statement).all())


# -------------------------
# CONVERSATIONS
# -------------------------

def create_conversation(
    db: Session,
    *,
    chatbot_id: UUID,
    session_id: str,
) -> Conversation:
    conversation = Conversation(
        chatbot_id=chatbot_id,
        session_id=session_id,
    )
    db.add(conversation)

    try:
        db.commit()
        db.refresh(conversation)
    except Exception:
        db.rollback()
        raise

    return conversation


def get_conversation(
    db: Session, conversation_id: UUID
) -> Conversation | None:
    return db.get(Conversation, conversation_id)


def list_conversations(
    db: Session, chatbot_id: UUID
) -> list[Conversation]:
    statement = (
        select(Conversation)
        .where(Conversation.chatbot_id == chatbot_id)
        .order_by(Conversation.created_at.desc())
    )
    return list(db.scalars(statement).all())



def get_conversation_by_session(
    db: Session,
    *,
    chatbot_id: UUID,
    session_id: str,
) -> Conversation | None:
    statement = select(Conversation).where(
        Conversation.chatbot_id == chatbot_id,
        Conversation.session_id == session_id,
    )
    return db.scalar(statement)


# -------------------------
# MESSAGES
# -------------------------

def save_message(
    db: Session,
    *,
    conversation_id: UUID,
    role: str,
    content: str,
) -> Message:
    if role not in {"user", "assistant", "system"}:
        raise ValueError(
            "role must be 'user', 'assistant', or 'system'"
        )

    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
    )
    db.add(message)

    try:
        db.commit()
        db.refresh(message)
    except Exception:
        db.rollback()
        raise

    return message


def get_messages(
    db: Session, conversation_id: UUID
) -> list[Message]:
    statement = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
    )
    return list(db.scalars(statement).all())


# -------------------------
# DOCUMENT CHUNKS
# -------------------------

def save_chunks(
    db: Session,
    *,
    page_id: UUID,
    chunks: list[dict],
) -> list[DocumentChunk]:
    """
    Each chunk must contain:
    {
        "content": "...",
        "embedding": [384 float values],
        "chunk_index": 0
    }

    Embeddings may be None until generated.
    """
    records = []

    for item in chunks:
        content = item.get("content")
        embedding = item.get("embedding")
        chunk_index = item.get("chunk_index")

        if not isinstance(content, str) or not content.strip():
            raise ValueError("Every chunk needs non-empty content")

        if not isinstance(chunk_index, int) or chunk_index < 0:
            raise ValueError("chunk_index must be a non-negative integer")

        if embedding is not None and len(embedding) != 384:
            raise ValueError(
                "Each embedding must contain exactly 384 values"
            )

        records.append(
            DocumentChunk(
                page_id=page_id,
                chunk_index=chunk_index,
                content=content,
                embedding=embedding,
            )
        )

    if not records:
        return []

    db.add_all(records)

    try:
        db.commit()
        for record in records:
            db.refresh(record)
    except Exception:
        db.rollback()
        raise

    return records


def search_chunks(
    db: Session,
    *,
    chatbot_id: UUID,
    query_embedding: list[float],
    limit: int = 5,
) -> list[DocumentChunk]:
    """
    Return the most similar embedded chunks belonging to a chatbot.
    query_embedding must contain 384 values.
    """
    if len(query_embedding) != 384:
        raise ValueError(
            "query_embedding must contain exactly 384 values"
        )

    if limit < 1:
        raise ValueError("limit must be at least 1")

    distance = DocumentChunk.embedding.cosine_distance(
        query_embedding
    )

    statement = (
        select(DocumentChunk)
        .join(WebsitePage, DocumentChunk.page_id == WebsitePage.id)
        .where(
            WebsitePage.chatbot_id == chatbot_id,
            DocumentChunk.embedding.is_not(None),
        )
        .order_by(distance.asc())
        .limit(limit)
    )

    return list(db.scalars(statement).all())


def save_user_openrouter_key(
    db: Session, *, owner_id: str, encrypted_api_key: str
) -> None:
    if not owner_id or not encrypted_api_key:
        raise ValueError("Owner and encrypted credential are required.")

    try:
        record = db.get(UserLLMCredential, owner_id)
        if record is None:
            db.add(UserLLMCredential(
                owner_id=owner_id,
                encrypted_api_key=encrypted_api_key,
            ))
        else:
            record.encrypted_api_key = encrypted_api_key
        db.commit()
    except Exception:
        db.rollback()
        raise


def get_user_openrouter_key(db: Session, *, owner_id: str) -> str | None:
    record = db.get(UserLLMCredential, owner_id)
    return record.encrypted_api_key if record else None


def delete_user_openrouter_key(db: Session, *, owner_id: str) -> None:
    try:
        record = db.get(UserLLMCredential, owner_id)
        if record is not None:
            db.delete(record)
            db.commit()
    except Exception:
        db.rollback()
        raise


# -------------------------
# INGESTION JOBS
# -------------------------

def create_ingestion_job(
    db: Session,
    *,
    chatbot_id: UUID,
    status: str = "queued",
    stage: str = "discovering",
) -> IngestionJob:
    job = IngestionJob(
        chatbot_id=chatbot_id,
        status=status,
        stage=stage,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_ingestion_job(db: Session, job_id: UUID) -> IngestionJob | None:
    return db.get(IngestionJob, job_id)


def get_latest_ingestion_job(
    db: Session, chatbot_id: UUID
) -> IngestionJob | None:
    statement = (
        select(IngestionJob)
        .where(IngestionJob.chatbot_id == chatbot_id)
        .order_by(IngestionJob.created_at.desc())
        .limit(1)
    )
    return db.scalar(statement)


def get_active_ingestion_job(
    db: Session, chatbot_id: UUID
) -> IngestionJob | None:
    statement = (
        select(IngestionJob)
        .where(
            IngestionJob.chatbot_id == chatbot_id,
            IngestionJob.status.in_(["queued", "running"]),
        )
        .order_by(IngestionJob.created_at.desc())
        .limit(1)
    )
    return db.scalar(statement)


def update_ingestion_job(
    db: Session,
    job_id: UUID,
    *,
    status: str | None = None,
    stage: str | None = None,
    pages_discovered: int | None = None,
    pages_saved: int | None = None,
    chunks_saved: int | None = None,
    pages_failed: int | None = None,
    error_message: str | None = None,
    completed_at=None,
) -> IngestionJob | None:
    job = db.get(IngestionJob, job_id)
    if job is None:
        return None

    if status is not None:
        job.status = status
    if stage is not None:
        job.stage = stage
    if pages_discovered is not None:
        job.pages_discovered = pages_discovered
    if pages_saved is not None:
        job.pages_saved = pages_saved
    if chunks_saved is not None:
        job.chunks_saved = chunks_saved
    if pages_failed is not None:
        job.pages_failed = pages_failed
    if error_message is not None:
        job.error_message = error_message
    if completed_at is not None:
        job.completed_at = completed_at

    db.commit()
    db.refresh(job)
    return job

