from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
)


class ChatRequest(BaseModel):
    chatbot_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)


class ChatResponse(BaseModel):
    status: str
    chatbot_id: str
    message: str
    reply: str


@router.post("/", response_model=ChatResponse)
async def send_message(request: ChatRequest) -> ChatResponse:
    return ChatResponse(
        status="success",
        chatbot_id=request.chatbot_id,
        message=request.message,
        reply="Chat endpoint is working. RAG integration is pending.",
    )