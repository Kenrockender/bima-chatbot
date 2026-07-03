from fastapi import APIRouter, Depends
from . import rag
from .ratelimit import RateLimiter
from .schemas import ChatRequest, ChatResponse


router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post(
    "",
    response_model=ChatResponse,
    dependencies=[Depends(RateLimiter("chat", max_calls=40, per_seconds=60))],
)
def chat(req: ChatRequest):
    history = [m.model_dump() for m in req.history]
    result = rag.answer(req.message, history, req.lang)
    return result
