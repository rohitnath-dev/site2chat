import json
import logging
from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database.connection import SessionLocal, get_db
from database import repository
from rag.provider_errors import CODE_CREDITS, CODE_KEY_INVALID, CODE_RATE_LIMITED, ProviderError
from rag.rag import rag_service


router = APIRouter(prefix="/chat", tags=["Chat"])

logger = logging.getLogger("site2chat.chat")

VISITOR_UNAVAILABLE_MESSAGE = "This chatbot is temporarily unable to respond. Please try again later."


def _provider_failure(exc: ProviderError) -> tuple[int, dict]:
    """Safe (status, body) for a provider failure. Details stay in the server log."""
    if exc.code in (CODE_CREDITS, CODE_KEY_INVALID):
        return 503, {"detail": VISITOR_UNAVAILABLE_MESSAGE, "code": "chatbot_unavailable"}
    if exc.code == CODE_RATE_LIMITED:
        return 503, {
            "detail": "This chatbot is busy right now. Please try again in a moment.",
            "code": "chatbot_busy",
        }
    return 502, {
        "detail": "The chatbot could not generate a response. Please try again.",
        "code": "chatbot_error",
    }


class ChatRequest(BaseModel):
    chatbot_id: UUID
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str | None = Field(default=None, min_length=1, max_length=128)


class ChatResponse(BaseModel):
    status: str
    chatbot_id: str
    conversation_id: str
    message: str
    reply: str


@router.post("/", response_model=ChatResponse)
def send_message(
    request: ChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=422,
            detail="Message cannot be empty.",
        )

    chatbot = repository.get_chatbot_by_id(db, request.chatbot_id)

    if chatbot is None:
        raise HTTPException(
            status_code=404,
            detail="Chatbot not found.",
        )

    if chatbot.status not in ("ready", "partial"):
        raise HTTPException(
            status_code=409,
            detail="This chatbot's website knowledge is not ready yet.",
        )

    try:
        # Reuse the supplied session or create a new one.
        session_id = request.session_id or str(uuid4())

        conversation = repository.get_conversation_by_session(
            db,
            chatbot_id=request.chatbot_id,
            session_id=session_id,
        )

        if conversation is None:
            conversation = repository.create_conversation(
                db,
                chatbot_id=request.chatbot_id,
                session_id=session_id,
            )

        # Save the user's message.
        repository.save_message(
            db,
            conversation_id=conversation.id,
            role="user",
            content=message,
        )

        # Retrieve relevant website chunks and generate an answer.
        reply = rag_service.answer(
            db,
            chatbot_id=request.chatbot_id,
            question=message,
        )

        # Save the assistant's response.
        repository.save_message(
            db,
            conversation_id=conversation.id,
            role="assistant",
            content=reply,
        )

        return ChatResponse(
            status="success",
            chatbot_id=str(request.chatbot_id),
            conversation_id=str(conversation.id),
            message=message,
            reply=reply,
        )

    except ProviderError as exc:
        db.rollback()
        # Visitors only ever get a neutral message and a safe code. Details stay in the server log.
        status_code, content = _provider_failure(exc)
        return JSONResponse(status_code=status_code, content=content)

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="A database error occurred while processing the message.",
        ) from exc

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail="The chatbot could not generate a response. Please try again.",
        ) from exc


@contextmanager
def open_session() -> Iterator[Session]:
    """A database session owned by the stream itself.

    The request-scoped session from get_db may already be closed by the time a streaming body runs,
    so the generator opens (and always closes) its own.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sse(event: str, data: dict) -> str:
    # json.dumps never emits raw newlines, so each event is exactly one "data:" line.
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _chat_events(request: ChatRequest, message: str) -> Iterator[str]:
    """Server-sent events for one chat turn: status, delta (repeated), then done or error."""
    parts: list[str] = []
    with open_session() as db:
        try:
            session_id = request.session_id or str(uuid4())
            conversation = repository.get_conversation_by_session(
                db, chatbot_id=request.chatbot_id, session_id=session_id
            )
            if conversation is None:
                conversation = repository.create_conversation(
                    db, chatbot_id=request.chatbot_id, session_id=session_id
                )
            repository.save_message(
                db, conversation_id=conversation.id, role="user", content=message
            )

            pipeline = rag_service.stream_answer(
                db, chatbot_id=request.chatbot_id, question=message
            )
            try:
                for kind, value in pipeline:
                    if kind == "status":
                        yield _sse("status", {"stage": value})
                    else:
                        parts.append(value)
                        yield _sse("delta", {"text": value})
            finally:
                # Also runs when the client disconnects: closes the upstream model connection.
                pipeline.close()

            reply = "".join(parts).strip()
            if not reply:
                raise RuntimeError("The chatbot returned an empty reply.")

            # Saved once, after the full text exists. An aborted or failed stream saves no assistant
            # message, matching the non-streaming endpoint (which saves nothing on failure).
            repository.save_message(
                db, conversation_id=conversation.id, role="assistant", content=reply
            )
            yield _sse("done", {"conversation_id": str(conversation.id)})

        except GeneratorExit:
            # Client went away; the pipeline was closed above. Nothing more to send.
            db.rollback()
            raise
        except ProviderError as exc:
            db.rollback()
            _, content = _provider_failure(exc)
            yield _sse("error", content)
        except ValueError as exc:
            db.rollback()
            yield _sse("error", {"detail": str(exc), "code": "chatbot_error"})
        except SQLAlchemyError:
            db.rollback()
            yield _sse(
                "error",
                {
                    "detail": "A database error occurred while processing the message.",
                    "code": "chatbot_error",
                },
            )
        except Exception:
            db.rollback()
            logger.exception("Streaming chat failed")
            yield _sse(
                "error",
                {
                    "detail": "The chatbot could not generate a response. Please try again.",
                    "code": "chatbot_error",
                },
            )


@router.post("/stream")
def send_message_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Streaming variant of POST /chat/ (server-sent events). The non-streaming endpoint is unchanged."""
    message = request.message.strip()

    if not message:
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    chatbot = repository.get_chatbot_by_id(db, request.chatbot_id)

    if chatbot is None:
        raise HTTPException(status_code=404, detail="Chatbot not found.")

    if chatbot.status not in ("ready", "partial"):
        raise HTTPException(
            status_code=409,
            detail="This chatbot's website knowledge is not ready yet.",
        )

    return StreamingResponse(
        _chat_events(request, message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
