
from uuid import UUID
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from database.models import Chatbot, DocumentChunk, WebsitePage
from rag.crawler import crawl_website
from rag.embeddings import EmbeddingService


embedding_service = EmbeddingService()


def ingest_website(
    db: Session,
    chatbot_id: UUID,
    *,
    max_pages: int = 100,
) -> dict[str, Any]:
    """
    Crawl a chatbot's website and store pages, chunks, and embeddings.

    Existing pages are updated instead of duplicated.
    Old chunks are replaced only after new embeddings are generated.
    Each page update is committed atomically.
    """

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

    # Crawl first, without modifying existing database records.
    documents = crawl_website(
        website_url=chatbot.website_url,
        max_pages=max_pages,
    )

    if not documents:
        raise ValueError("No usable pages were extracted.")

    # Deduplicate URLs while preserving the first occurrence's order.
    unique_documents: dict[str, dict[str, str]] = {}

    for document in documents:
        url = document.get("url", "").strip()
        title = document.get("title", "").strip()
        content = document.get("content", "").strip()

        if not url or not content:
            continue

        unique_documents[url] = {
            "url": url,
            "title": title or "Untitled page",
            "content": content,
        }

    if not unique_documents:
        raise ValueError("No valid page content was extracted.")

    pages_saved = 0
    chunks_saved = 0
    failures: list[dict[str, str]] = []

    for document in unique_documents.values():
        url = document["url"]

        try:
            # Generate embeddings before replacing existing page data.
            chunks = embedding_service.embed_documents([document])

            if not chunks:
                raise ValueError("No chunks were generated.")

            database_chunks = []

            for chunk in chunks:
                text = chunk["text"].strip()
                metadata = chunk["metadata"]
                embedding = chunk["embedding"]
                chunk_index = metadata["chunk_index"]

                if not text:
                    continue

                if len(embedding) != 384:
                    raise ValueError(
                        "Embedding dimension must be 384."
                    )

                database_chunks.append({
                    "chunk_index": chunk_index,
                    "content": text,
                    "embedding": embedding,
                })

            if not database_chunks:
                raise ValueError("No valid chunks were generated.")

            # Start an isolated transaction for this page.
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

            # Remove old chunks only after new embeddings are ready.
            db.execute(
                delete(DocumentChunk).where(
                    DocumentChunk.page_id == page.id
                )
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

            # Page update and chunk replacement commit together.
            db.commit()

            pages_saved += 1
            chunks_saved += len(database_chunks)

        except Exception as exc:
            db.rollback()

            # Keep processing other pages, but report failures.
            failures.append({
                "url": url,
                "error": str(exc),
            })

    # Do not mark the chatbot ready if every page failed.
    if pages_saved == 0:
        raise RuntimeError(
            "Website ingestion failed for every page. "
            f"Failed pages: {len(failures)}"
        )

    # Refresh chatbot status after at least one successful page.
    try:
        chatbot = db.get(Chatbot, chatbot_id)

        if chatbot is not None:
            chatbot.status = (
                "ready" if not failures else "partial"
            )
            db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "status": "success" if not failures else "partial",
        "chatbot_id": str(chatbot_id),
        "pages_discovered": len(unique_documents),
        "pages_saved": pages_saved,
        "chunks_saved": chunks_saved,
        "pages_failed": len(failures),
        "failures": failures,
    }
