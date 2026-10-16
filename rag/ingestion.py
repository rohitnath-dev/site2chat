import datetime
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from database.connection import get_sessionmaker
from database.models import Chatbot, DocumentChunk, IngestionJob, WebsitePage
from database import repository
from rag.crawler import crawl_website
from rag.embeddings import embedding_service

logger = logging.getLogger("site2chat.ingestion")


def ingest_website(
    db: Session,
    chatbot_id: UUID,
    *,
    max_pages: int = 100,
    job_id: UUID | None = None,
) -> dict[str, Any]:
    """Crawl a chatbot site and atomically replace chunks page by page while updating job state."""
    if not isinstance(chatbot_id, UUID):
        raise ValueError("chatbot_id must be a UUID.")
    if (
        not isinstance(max_pages, int)
        or isinstance(max_pages, bool)
        or not 1 <= max_pages <= 1000
    ):
        raise ValueError("max_pages must be an integer between 1 and 1000.")

    chatbot = db.get(Chatbot, chatbot_id)
    if chatbot is None:
        raise ValueError("Chatbot not found.")

    if job_id:
        repository.update_ingestion_job(
            db,
            job_id,
            status="running",
            stage="discovering",
        )

    try:
        documents = crawl_website(
            website_url=chatbot.website_url,
            max_pages=max_pages,
        )
    except Exception as exc:
        if job_id:
            repository.update_ingestion_job(
                db,
                job_id,
                status="failed",
                stage="failed",
                error_message=f"Crawling failed: {exc}",
                completed_at=datetime.datetime.now(datetime.timezone.utc),
            )
            chatbot = db.get(Chatbot, chatbot_id)
            if chatbot:
                chatbot.status = "failed"
                db.commit()
        raise

    if not documents:
        msg = "No usable pages were extracted from the website."
        if job_id:
            repository.update_ingestion_job(
                db,
                job_id,
                status="failed",
                stage="failed",
                error_message=msg,
                completed_at=datetime.datetime.now(datetime.timezone.utc),
            )
            chatbot = db.get(Chatbot, chatbot_id)
            if chatbot:
                chatbot.status = "failed"
                db.commit()
        raise ValueError(msg)

    # Keep the first occurrence of each URL, preserving crawl order.
    unique_documents: dict[str, dict[str, str]] = {}
    for document in documents:
        url = document.get("url", "").strip()
        title = document.get("title", "").strip()
        content = document.get("content", "").strip()
        if url and content:
            unique_documents.setdefault(
                url,
                {
                    "url": url,
                    "title": title or "Untitled page",
                    "content": content,
                },
            )

    if not unique_documents:
        msg = "No valid page content was extracted."
        if job_id:
            repository.update_ingestion_job(
                db,
                job_id,
                status="failed",
                stage="failed",
                error_message=msg,
                completed_at=datetime.datetime.now(datetime.timezone.utc),
            )
            chatbot = db.get(Chatbot, chatbot_id)
            if chatbot:
                chatbot.status = "failed"
                db.commit()
        raise ValueError(msg)

    if job_id:
        repository.update_ingestion_job(
            db,
            job_id,
            stage="embedding",
            pages_discovered=len(unique_documents),
        )

    pages_saved = 0
    chunks_saved = 0
    failures: list[dict[str, str]] = []

    for document in unique_documents.values():
        url = document["url"]
        try:
            chunks = embedding_service.embed_documents([document])
            if not chunks:
                raise ValueError("No chunks were generated.")

            database_chunks = []
            for chunk in chunks:
                text = chunk["text"].strip()
                embedding = chunk["embedding"]
                chunk_index = chunk["metadata"]["chunk_index"]
                if not text:
                    continue
                if len(embedding) != 384:
                    raise ValueError("Embedding dimension must be 384.")
                database_chunks.append(
                    {
                        "chunk_index": chunk_index,
                        "content": text,
                        "embedding": embedding,
                    }
                )

            if not database_chunks:
                raise ValueError("No valid chunks were generated.")

            page = db.scalar(
                select(WebsitePage).where(
                    WebsitePage.chatbot_id == chatbot_id,
                    WebsitePage.url == url,
                )
            )
            if page is None:
                page = WebsitePage(
                    chatbot_id=chatbot_id,
                    url=url,
                    title=document["title"],
                    content=document["content"],
                    status="completed",
                )
                db.add(page)
                db.flush()
            else:
                page.title = document["title"]
                page.content = document["content"]
                page.status = "completed"

            db.execute(
                delete(DocumentChunk).where(DocumentChunk.page_id == page.id)
            )
            for item in database_chunks:
                db.add(
                    DocumentChunk(
                        page_id=page.id,
                        chunk_index=item["chunk_index"],
                        content=item["content"],
                        embedding=item["embedding"],
                    )
                )
            db.commit()
            pages_saved += 1
            chunks_saved += len(database_chunks)

            if job_id:
                repository.update_ingestion_job(
                    db,
                    job_id,
                    stage="persisting",
                    pages_saved=pages_saved,
                    chunks_saved=chunks_saved,
                    pages_failed=len(failures),
                )
        except Exception as exc:
            db.rollback()
            logger.warning("Failed processing page %s: %s", url, exc)
            failures.append({"url": url, "error": "Page processing failed."})

    if pages_saved == 0:
        msg = f"Website ingestion failed for every page. Failed pages: {len(failures)}"
        if job_id:
            repository.update_ingestion_job(
                db,
                job_id,
                status="failed",
                stage="failed",
                error_message=msg,
                completed_at=datetime.datetime.now(datetime.timezone.utc),
            )
            chatbot = db.get(Chatbot, chatbot_id)
            if chatbot:
                chatbot.status = "failed"
                db.commit()
        raise RuntimeError(msg)

    try:
        chatbot = db.get(Chatbot, chatbot_id)
        final_bot_status = "ready" if not failures else "partial"
        if chatbot is not None:
            chatbot.status = final_bot_status
            db.commit()

        if job_id:
            repository.update_ingestion_job(
                db,
                job_id,
                status="completed",
                stage="completed",
                pages_saved=pages_saved,
                chunks_saved=chunks_saved,
                pages_failed=len(failures),
                completed_at=datetime.datetime.now(datetime.timezone.utc),
            )
    except Exception:
        db.rollback()
        raise

    return {
        "status": "success" if not failures else "partial",
        "chatbot_id": str(chatbot_id),
        "job_id": str(job_id) if job_id else None,
        "pages_discovered": len(unique_documents),
        "pages_saved": pages_saved,
        "chunks_saved": chunks_saved,
        "pages_failed": len(failures),
        "failures": failures,
    }


def run_background_ingest(
    job_id: UUID,
    chatbot_id: UUID,
    *,
    max_pages: int = 100,
) -> None:
    """Entry point for FastAPI BackgroundTasks runner."""
    session_factory = get_sessionmaker()
    db = session_factory()
    logger.info("Starting background ingestion job %s for chatbot %s", job_id, chatbot_id)
    try:
        result = ingest_website(
            db,
            chatbot_id,
            max_pages=max_pages,
            job_id=job_id,
        )
        logger.info(
            "Completed ingestion job %s: status=%s, pages=%d, chunks=%d",
            job_id,
            result["status"],
            result["pages_saved"],
            result["chunks_saved"],
        )
    except Exception as exc:
        logger.error("Background ingestion job %s failed: %s", job_id, exc, exc_info=True)
    finally:
        db.close()

