from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database.connection import get_db
from database import repository
from rag.rag import rag_service


router = APIRouter(prefix="/chat", tags=["Chat"])


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