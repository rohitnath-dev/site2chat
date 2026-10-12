from fastapi import APIRouter

router = APIRouter(
  prefix="/chatbots",
  tags="Chatbots"
)

@router.get("/")
async def chatbots() -> dict[str, str]:
  pass
