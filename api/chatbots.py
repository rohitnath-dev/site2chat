from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from core.auth import get_current_user
from core.secret_store import CredentialEncryptionError, encrypt_secret
from database import repository
from database.connection import get_db
from database.models import Chatbot
from rag.provider_errors import (
    CODE_CREDITS,
    CODE_KEY_INVALID,
    DEFAULT_SCOPE,
    clear_issue,
    get_issue,
    owner_scope,
)
from rag.crawler import validate_website_url
from rag.ingestion import ingest_website, run_background_ingest


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
    llm_provider: str = "groq"
    llm_model: str | None = None

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
    # Deduplication guard: reuse existing active/pending chatbot with same website
    # to prevent accidental duplicates on retry or connection drops
    existing = repository.list_chatbots(db, owner_id=current_user["sub"], limit=10)
    for bot in existing:
        if (
            bot.website_url == payload.website_url
            and bot.status in ("pending", "queued", "running")
        ):
            return bot

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
    background_tasks: BackgroundTasks,
    sync: bool = Query(default=False),
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

    # Check if an active ingestion job is already running
    active_job = repository.get_active_ingestion_job(db, chatbot_id)
    if active_job:
        return {
            "status": active_job.status,
            "chatbot_id": str(chatbot_id),
            "job_id": str(active_job.id),
            "stage": active_job.stage,
            "pages_discovered": active_job.pages_discovered,
            "pages_saved": active_job.pages_saved,
            "chunks_saved": active_job.chunks_saved,
            "pages_failed": active_job.pages_failed,
            "failures": [],
        }

    job = repository.create_ingestion_job(
        db, chatbot_id=chatbot_id, status="queued", stage="discovering"
    )
    chatbot.status = "queued"
    db.commit()

    if sync:
        try:
            return ingest_website(db, chatbot_id, max_pages=100, job_id=job.id)
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

    # Launch background ingestion job
    background_tasks.add_task(
        run_background_ingest,
        job.id,
        chatbot_id,
        max_pages=100,
    )
    return {
        "status": "queued",
        "chatbot_id": str(chatbot_id),
        "job_id": str(job.id),
        "stage": "discovering",
        "pages_discovered": 0,
        "pages_saved": 0,
        "chunks_saved": 0,
        "pages_failed": 0,
        "failures": [],
    }


@router.get("/{chatbot_id}/ingest/status")
def get_chatbot_ingest_status(
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

    job = repository.get_latest_ingestion_job(db, chatbot_id)
    if job is None:
        return {
            "status": chatbot.status,
            "chatbot_id": str(chatbot_id),
            "job_id": None,
            "stage": None,
            "pages_discovered": 0,
            "pages_saved": 0,
            "chunks_saved": 0,
            "pages_failed": 0,
            "error_message": None,
            "failures": [],
        }

    return {
        "status": job.status,
        "chatbot_id": str(chatbot_id),
        "job_id": str(job.id),
        "stage": job.stage,
        "pages_discovered": job.pages_discovered,
        "pages_saved": job.pages_saved,
        "chunks_saved": job.chunks_saved,
        "pages_failed": job.pages_failed,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "failures": [],
    }



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
        # A new key deserves a fresh start: drop any stale warning about the old one.
        clear_issue(owner_scope(current_user["sub"]))
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


@router.get("/credentials/ai-status")
def ai_provider_status(
    current_user: dict = Depends(get_current_user),
) -> dict[str, dict[str, str]]:
    """Confirmed provider problems only (credits/billing or a rejected key); everything else is "ok"."""
    default_issue = get_issue(DEFAULT_SCOPE)
    own_issue = get_issue(owner_scope(current_user["sub"]))
    return {
        "default_provider": {
            "status": "credits_exhausted" if default_issue == CODE_CREDITS else "ok"
        },
        "own_openrouter": {
            "status": (
                "credits_exhausted"
                if own_issue == CODE_CREDITS
                else "key_invalid"
                if own_issue == CODE_KEY_INVALID
                else "ok"
            )
        },
    }


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
        clear_issue(owner_scope(current_user["sub"]))
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Credential could not be removed.",
        ) from exc
    return {"status": "success", "message": "OpenRouter key removed."}
