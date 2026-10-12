from fastapi import APIRouter

router = APIRouter(
  prefix="/chat",
  tags="Chat",
)

@router.get("/")
async def chat() -> dict[str, str]:
  pass