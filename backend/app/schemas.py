from typing import Optional, List, Literal
from pydantic import BaseModel, HttpUrl


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    lang: Optional[Literal["en", "id"]] = None


class SourceRef(BaseModel):
    name: Optional[str]
    type: Optional[str]
    page: Optional[int] = None
    url: Optional[str] = None


class Escalation(BaseModel):
    whatsapp: str
    email: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceRef]
    lang: str
    fallback: bool
    escalation: Optional[Escalation] = None


class UrlIngestRequest(BaseModel):
    url: HttpUrl
    name: Optional[str] = None


class SourceOut(BaseModel):
    id: str
    name: str
    type: str
    origin: str
    status: str
    error: Optional[str]
    chunk_count: int
    created_at: str
    updated_at: str
