from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from core.auth import get_current_user
from core.secret_store import CredentialEncryptionError, encrypt_secret
from database import repository
from database.connection import get_db
from database.models import Chatbot
from rag.crawler import validate_website_url
from rag.ingestion import ingest_website


router = APIRouter(prefix="/chatbots", tags=["Chatbots"])


class ChatbotCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    website_url: str = Field(..., min_length=1, max_length=2048)
    description: str | None = Field(default=None, max_length=5000)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("Name must be a string.")
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be empty.")
        return value

    @field_validator("website_url", mode="before")
    @classmethod
    def validate_url(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("Website URL must be a string.")
        # The crawler repeats DNS/public-IP checks immediately before each fetch.
        return validate_website_url(value)


class ChatbotLLMSettingsUpdate(BaseModel):
    llm_provider: str = Field(..., pattern="^(groq|openrouter)$")
    llm_model: str = Field(..., min_length=1, max_length=150)

    @field_validator("llm_model", mode="before")
    @classmethod
    def strip_model(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("Model must be a string.")
        value = value.strip()
        if not value:
            raise ValueError("Model cannot be empty.")
        return value


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


class OpenRouterKeyInput(BaseModel):
    api_key: str = Field(..., min_length=10, max_length=500)

    @field_validator("api_key", mode="before")
    @classmethod
    def strip_and_validate_api_key(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("API key must be a string.")
        value = value.strip()
        if not 10 <= len(value) <= 500:
            raise ValueError("API key must be between 10 and 500 characters.")
        return value


@router.get("/", response_model=ChatbotListResponse)
def list_chatbots(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ChatbotListResponse:
    chatbots = repository.list_chatbots(db, owner_id=current_user["sub"])
    return ChatbotListResponse(status="success", chatbots=chatbots)


@router.post(
    "/", response_model=ChatbotResponse, status_code=status.HTTP_201_CREATED
)
def create_chatbot(
    payload: ChatbotCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Chatbot:
    return repository.create_chatbot(
        db,
        name=payload.name,
        website_url=payload.website_url,
        description=payload.description,
        owner_id=current_user["sub"],
    )


@router.get("/{chatbot_id}", response_model=ChatbotResponse)
def get_chatbot(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Chatbot:
    chatbot = repository.get_chatbot(
        db, chatbot_id, owner_id=current_user["sub"]
    )
    if chatbot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found.",
        )
    return chatbot


@router.patch("/{chatbot_id}/llm-settings", response_model=ChatbotResponse)
def update_chatbot_llm_settings_endpoint(
    chatbot_id: UUID,
    payload: ChatbotLLMSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Chatbot:
    chatbot = repository.update_chatbot_llm_settings(
        db,
        chatbot_id,
        owner_id=current_user["sub"],
        llm_provider=payload.llm_provider,
        llm_model=payload.llm_model,
    )
    if chatbot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found.",
        )
    return chatbot


@router.delete("/{chatbot_id}")
def delete_chatbot(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, str]:
    deleted = repository.delete_chatbot(
        db, chatbot_id, owner_id=current_user["sub"]
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found.",
        )
    return {"status": "success", "message": "Chatbot deleted."}


@router.post("/{chatbot_id}/ingest")
def ingest_chatbot_website(
    chatbot_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    chatbot = repository.get_chatbot(
        db, chatbot_id, owner_id=current_user["sub"]
    )
    if chatbot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found.",
        )

    try:
        return ingest_website(db, chatbot_id, max_pages=100)
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
            detail="Website ingestion failed. Check server logs.",
        ) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Website ingestion failed.",
        ) from exc


@router.put(
    "/credentials/openrouter",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
def save_openrouter_key(
    payload: OpenRouterKeyInput,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> None:
    try:
        encrypted = encrypt_secret(payload.api_key)
        repository.save_user_openrouter_key(
            db,
            owner_id=current_user["sub"],
            encrypted_api_key=encrypted,
        )
    except CredentialEncryptionError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Credential encryption is unavailable.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Credential could not be saved.",
        ) from exc


@router.get("/credentials/openrouter")
def openrouter_key_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, bool]:
    encrypted = repository.get_user_openrouter_key(
        db, owner_id=current_user["sub"]
    )
    return {"configured": encrypted is not None}


@router.delete("/credentials/openrouter")
def remove_openrouter_key(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, str]:
    try:
        repository.delete_user_openrouter_key(db, owner_id=current_user["sub"])
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Credential could not be removed.",
        ) from exc
    return {"status": "success", "message": "OpenRouter key removed."}
