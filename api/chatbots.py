from rag.ingestion import ingest_website
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.connection import get_db
from database import repository
from database.models import Chatbot


router = APIRouter(
    prefix="/chatbots",
    tags=["Chatbots"],
)


class ChatbotCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    website_url: str = Field(..., min_length=1)
    description: str | None = None


class ChatbotResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    website_url: str
    public_id: str
    status: str

    model_config = {"from_attributes": True}


class ChatbotListResponse(BaseModel):
    status: str
    chatbots: list[ChatbotResponse]


@router.get("/", response_model=ChatbotListResponse)
def list_chatbots(
    db: Session = Depends(get_db),
) -> ChatbotListResponse:
    chatbots = repository.list_chatbots(db)

    return ChatbotListResponse(
        status="success",
        chatbots=chatbots,
    )


@router.post(
    "/",
    response_model=ChatbotResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_chatbot(
    payload: ChatbotCreate,
    db: Session = Depends(get_db),
) -> Chatbot:
    return repository.create_chatbot(
        db,
        name=payload.name,
        website_url=payload.website_url,
        description=payload.description,
    )


@router.get("/{chatbot_id}", response_model=ChatbotResponse)
def get_chatbot(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
) -> Chatbot:
    chatbot = repository.get_chatbot(db, chatbot_id)

    if chatbot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found",
        )

    return chatbot


@router.delete("/{chatbot_id}")
def delete_chatbot(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    deleted = repository.delete_chatbot(db, chatbot_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found",
        )

    return {
        "status": "success",
        "message": "Chatbot deleted",
    }


@router.post("/{chatbot_id}/ingest")
def ingest_chatbot_website(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    chatbot = repository.get_chatbot(db, chatbot_id)

    if chatbot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found",
        )

    try:
        return ingest_website(
            db,
            chatbot_id,
            max_pages=100,
        )

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Website ingestion failed",
        ) from exc