from fastapi import APIRouter
from . import rag
from .schemas import ChatRequest, ChatResponse


router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(req: ChatRequest):
    history = [m.model_dump() for m in req.history]
    result = rag.answer(req.message, history, req.lang)
    return result
