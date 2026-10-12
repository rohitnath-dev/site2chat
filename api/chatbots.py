from fastapi import APIRouter

router = APIRouter(
    prefix="/chatbots",
    tags=["Chatbots"],
)


@router.get("/")
async def list_chatbots() -> dict:
    return {
        "status": "success",
        "message": "Chatbots API is working",
        "chatbots": [],
    }


@router.post("/")
async def create_chatbot() -> dict:
    return {
        "status": "success",
        "message": "Chatbot creation endpoint is ready",
    }