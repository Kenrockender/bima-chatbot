from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict

from . import personas, training


router = APIRouter(prefix="/api/training", tags=["training"])


class PersonaPublic(BaseModel):
    id: str
    name: str
    title: str
    summary: str
    challenge: str
    accent: str


class StartRequest(BaseModel):
    persona_id: str


class StartResponse(BaseModel):
    session_id: str
    persona: PersonaPublic
    opening_message: str


class ChatRequest(BaseModel):
    session_id: str
    message: str


class FactRef(BaseModel):
    name: Optional[str] = None
    page: Optional[int] = None


class ChatResponse(BaseModel):
    reply: str
    facts_referenced: List[FactRef]


class EndRequest(BaseModel):
    session_id: str


class Scores(BaseModel):
    rapport: int
    discovery: int
    product_knowledge: int
    objection_handling: int
    closing: int


class EndResponse(BaseModel):
    persona: PersonaPublic
    scores: Scores
    overall_score: int
    strengths: List[str]
    improvements: List[str]
    next_focus: str
    turn_count: int
    raw: Optional[str] = None


@router.get("/personas", response_model=List[PersonaPublic])
def list_personas():
    return personas.list_public()


@router.post("/start", response_model=StartResponse)
def start(req: StartRequest):
    try:
        return training.start_session(req.persona_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown persona")


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        return training.reply(req.session_id, req.message)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found or expired")


@router.post("/end", response_model=EndResponse)
def end(req: EndRequest):
    try:
        return training.end_session(req.session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found or expired")
