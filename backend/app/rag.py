"""BIMA chat pipeline — in-memory PDF store, DeepSeek via OpenRouter.

Design:
- Dataset is small (3 PDFs, ~30k tokens total), so we stuff *all* documents
  into every prompt instead of doing RAG. No embeddings, no vector store.
- All PDF/URL text is held in process memory, loaded at startup from the
  filesystem paths stored in SQLite.
- Prompt prefix (system + DOCUMENTS block) is stable across requests, which
  lets DeepSeek's automatic prompt cache kick in (~10x cheaper, faster).
"""
import re
import logging
import threading
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
import pdfplumber
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from .config import settings


log = logging.getLogger("bima.rag")
if not log.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


# -----------------------------------------------------------------------------
# LLM singletons (DeepSeek via OpenRouter)
# -----------------------------------------------------------------------------

_lock = threading.Lock()
_llm = None
_strict_llm = None
_helper_llm = None


def _build_chat(temperature: float, json_mode: bool = False) -> ChatOpenAI:
    if not settings.openrouter_api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. This app requires OpenRouter "
            "(DeepSeek) for chat — see .env.example."
        )
    kwargs = {
        "model": settings.openrouter_chat_model,
        "api_key": settings.openrouter_api_key,
        "base_url": settings.openrouter_base_url,
        "temperature": temperature,
    }
    if json_mode:
        kwargs["model_kwargs"] = {"response_format": {"type": "json_object"}}
    return ChatOpenAI(**kwargs)


def get_llm() -> ChatOpenAI:
    """Main chat LLM — persona roleplay & generative tasks."""
    global _llm
    if _llm is None:
        with _lock:
            if _llm is None:
                _llm = _build_chat(temperature=0.7)
    return _llm


def get_strict_llm() -> ChatOpenAI:
    """Low-temperature LLM for JSON-structured outputs (evaluator, recommender)."""
    global _strict_llm
    if _strict_llm is None:
        with _lock:
            if _strict_llm is None:
                _strict_llm = _build_chat(temperature=0.1, json_mode=True)
    return _strict_llm


def get_helper_llm() -> ChatOpenAI:
    """Low-temp free-form helper (translation, query rewriting)."""
    global _helper_llm
    if _helper_llm is None:
        with _lock:
            if _helper_llm is None:
                _helper_llm = _build_chat(temperature=0.1, json_mode=False)
    return _helper_llm


# -----------------------------------------------------------------------------
# In-memory document store
# -----------------------------------------------------------------------------

# source_id -> { name, type, text }
_DOCS: Dict[str, Dict[str, str]] = {}
_DOCS_LOCK = threading.Lock()

# Cached concatenated DOCUMENTS block — invalidated on add/delete so that the
# prompt prefix stays byte-identical between chats (cache-friendly).
_DOCS_BLOCK: Optional[str] = None


def _invalidate_block() -> None:
    global _DOCS_BLOCK
    _DOCS_BLOCK = None


def _build_block() -> str:
    """Render the full DOCUMENTS block. Sorted by name for determinism."""
    items = sorted(_DOCS.values(), key=lambda d: d["name"].lower())
    if not items:
        return "(belum ada dokumen produk yang diunggah)"
    parts = []
    for d in items:
        parts.append(f"=== {d['name']} ===\n{d['text'].strip()}")
    return "\n\n".join(parts)


def documents_block() -> str:
    """Get the cached DOCUMENTS block (built once until docs change)."""
    global _DOCS_BLOCK
    if _DOCS_BLOCK is None:
        with _DOCS_LOCK:
            if _DOCS_BLOCK is None:
                _DOCS_BLOCK = _build_block()
    return _DOCS_BLOCK


def list_documents() -> List[Dict[str, str]]:
    with _DOCS_LOCK:
        return [
            {"id": sid, "name": d["name"], "type": d["type"]}
            for sid, d in _DOCS.items()
        ]


def get_document(source_id: str) -> Optional[Dict[str, str]]:
    with _DOCS_LOCK:
        d = _DOCS.get(source_id)
        return dict(d) if d else None


def _store(source_id: str, name: str, source_type: str, text: str) -> None:
    with _DOCS_LOCK:
        _DOCS[source_id] = {"name": name, "type": source_type, "text": text}
    _invalidate_block()


def delete_source(source_id: str) -> None:
    with _DOCS_LOCK:
        _DOCS.pop(source_id, None)
    _invalidate_block()


# -----------------------------------------------------------------------------
# Extractors + ingestion
# -----------------------------------------------------------------------------

def extract_pdf_text(path: str) -> Tuple[str, int]:
    """Returns (full_text_with_page_tags, page_count)."""
    parts: List[str] = []
    page_count = 0
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            page_count = i
            text = (page.extract_text() or "").strip()
            if text:
                parts.append(f"[hal. {i}]\n{text}")
    return "\n\n".join(parts), page_count


def extract_url_text(url: str) -> str:
    resp = requests.get(url, timeout=30, headers={"User-Agent": "BIMA/1.0"})
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


def ingest_pdf(source_id: str, source_name: str, file_path: str) -> int:
    """Returns page count (stored in sources.chunk_count for UI display)."""
    text, page_count = extract_pdf_text(file_path)
    if not text.strip():
        return 0
    _store(source_id, source_name, "pdf", text)
    log.info("ingested pdf %s (%d pages, %d chars)", source_name, page_count, len(text))
    return page_count


def ingest_url(source_id: str, source_name: str, url: str) -> int:
    """Returns 1 on success (URLs don't have pages)."""
    text = extract_url_text(url)
    if not text.strip():
        return 0
    _store(source_id, source_name, "url", text)
    log.info("ingested url %s (%d chars)", source_name, len(text))
    return 1


# -----------------------------------------------------------------------------
# Language detection
# -----------------------------------------------------------------------------

_ID_HINTS = re.compile(
    r"\b(yang|dan|atau|dengan|untuk|tidak|adalah|saya|kamu|kita|mereka|"
    r"apa|bagaimana|berapa|kapan|siapa|mengapa|kenapa|dimana|di|ke|dari|"
    r"itu|ini|jadi|harus|bisa|akan|sudah|tentang|produk|asuransi|"
    r"jelaskan|lebih|detail|coba|bedanya|perbedaan)\b",
    re.IGNORECASE,
)
_EN_HINTS = re.compile(
    r"\b(the|and|or|with|for|not|is|are|i|you|we|they|"
    r"what|how|why|when|who|where|this|that|insurance|please|"
    r"explain|tell|give|show|difference|between|about)\b",
    re.IGNORECASE,
)


def detect_lang(text: str) -> str:
    """Return 'id' or 'en'. Heuristic — robust on short queries where langdetect fails."""
    if not text or not text.strip():
        return "en"
    id_score = len(_ID_HINTS.findall(text))
    en_score = len(_EN_HINTS.findall(text))
    if id_score == 0 and en_score == 0:
        try:
            from langdetect import detect
            return "id" if detect(text) == "id" else "en"
        except Exception:
            return "en"
    return "id" if id_score >= en_score else "en"


# -----------------------------------------------------------------------------
# Standalone-question rewriter (for follow-ups)
# -----------------------------------------------------------------------------

_REWRITE_SYSTEM = (
    "You rewrite a follow-up question into a self-contained standalone question.\n"
    "Use the prior conversation to resolve pronouns and references like "
    "\"it\", \"that product\", \"lebih detail\", \"tell me more\", \"yang itu\".\n"
    "Output ONLY the standalone question. Do not answer it. "
    "Keep the original language of the follow-up."
)


def rewrite_standalone(question: str, history: List[Dict[str, str]]) -> str:
    if not history:
        return question
    convo = "\n".join(
        f"{h['role'].upper()}: {h['content']}" for h in history[-4:]
    )
    try:
        out = get_helper_llm().invoke([
            SystemMessage(content=_REWRITE_SYSTEM),
            HumanMessage(content=(
                f"Conversation so far:\n{convo}\n\n"
                f"Follow-up: {question}\n\nStandalone question:"
            )),
        ])
        text = (out.content or "").strip().strip('"').strip("'")
        if not text or len(text) > 400:
            return question
        return text
    except Exception as e:
        log.warning("rewrite failed: %s", e)
        return question


# -----------------------------------------------------------------------------
# Chat prompts
# -----------------------------------------------------------------------------

SYSTEM_EN = """You are BIMA (BCA Life Intelligent Mobile Assistant), a friendly, professional onboarding assistant for new BCA Life staff.

CONTEXT LANGUAGE NOTE: BCA Life product documents are typically in Indonesian. The DOCUMENTS block below is often in Indonesian even when the question is in English. Translate the relevant Indonesian facts into English when you answer — this is expected behaviour, not a mismatch.

ANSWERING RULES:
1. Use ONLY the DOCUMENTS below as your source of facts. Do not bring in outside knowledge about BCA Life or insurance.
2. Extract every relevant detail from the DOCUMENTS to answer the question fully. For comparative questions, present each product's facts side by side.
3. Be specific: cite product names, ages, sums, percentages, eligibility windows, and terms exactly as they appear.
4. If the DOCUMENTS mention the product or topic asked about, you MUST answer with what is available. NEVER reply with NO_ANSWER in that case. Do not hedge with phrases like "I don't have enough detail" or "please refer to the document".
5. ONLY when the DOCUMENTS contain nothing related to the question, reply with exactly: NO_ANSWER
6. When you cite a fact, reference the source like [Product Name, p.N] using the page tags inside the DOCUMENTS block.
7. Format with short paragraphs, bold headings, and bullet lists when helpful. Use Markdown.
8. Tone: warm, professional, and direct.
9. Always answer in English."""

SYSTEM_ID = """Kamu adalah BIMA (BCA Life Intelligent Mobile Assistant), asisten onboarding yang ramah dan profesional untuk staf baru BCA Life.

ATURAN MENJAWAB:
1. Gunakan HANYA DOKUMEN di bawah sebagai sumber fakta. Jangan memakai pengetahuan di luar dokumen.
2. Ambil setiap detail relevan untuk menjawab pertanyaan secara lengkap. Untuk pertanyaan komparatif, sajikan fakta tiap produk berdampingan.
3. Spesifik: sebutkan nama produk, usia, jumlah, persentase, masa pertanggungan, dan istilah persis seperti tertulis.
4. Jika DOKUMEN menyebut produk atau topik yang ditanya, kamu HARUS menjawab dengan apa yang tersedia. JANGAN balas NO_ANSWER pada kasus ini. JANGAN mengelak dengan frasa seperti "saya tidak memiliki detail" atau "silakan merujuk dokumen".
5. HANYA jika DOKUMEN tidak memuat apa pun yang terkait dengan pertanyaan, balas persis: NO_ANSWER
6. Saat mengutip fakta, sebutkan sumbernya dengan format [Nama Produk, hal. N] menggunakan tag halaman di dalam blok DOKUMEN.
7. Format dengan paragraf pendek, judul tebal, dan bullet list bila membantu. Gunakan Markdown.
8. Nada: ramah, profesional, dan langsung.
9. Selalu jawab dalam Bahasa Indonesia."""


def _system_with_docs(lang: str) -> str:
    """System message + DOCUMENTS block. Same prefix every call → cache hit."""
    base = SYSTEM_ID if lang == "id" else SYSTEM_EN
    return f"{base}\n\nDOCUMENTS:\n{documents_block()}"


# -----------------------------------------------------------------------------
# Answer
# -----------------------------------------------------------------------------

_NO_ANSWER_RX = re.compile(r"\bNO[_\s-]?ANSWER\b", re.IGNORECASE)


def _is_no_answer(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return True
    if len(t) < 60 and _NO_ANSWER_RX.search(t):
        return True
    return False


def _strip_sentinel(text: str) -> str:
    return _NO_ANSWER_RX.sub("", text or "").strip()


def _fallback(lang: str) -> Dict:
    if lang == "id":
        msg = "Maaf, saya belum punya informasi tentang itu. Silakan hubungi tim kami untuk bantuan."
    else:
        msg = "I'm sorry, I don't have information about that. Please contact our team for help."
    return {
        "answer": msg,
        "sources": [],
        "lang": lang,
        "fallback": True,
        "escalation": {
            "whatsapp": settings.escalation_whatsapp,
            "email": settings.escalation_email,
        },
    }


def _sources_listing() -> List[Dict]:
    """All loaded docs become 'sources' — citation precision is up to the LLM via [name, p.N] tags."""
    return [
        {"name": d["name"], "type": d["type"], "page": None, "url": None}
        for d in sorted(_DOCS.values(), key=lambda d: d["name"].lower())
    ]


def _generate(system: str, user: str, *, llm=None) -> str:
    out = (llm or get_llm()).invoke([
        SystemMessage(content=system),
        HumanMessage(content=user),
    ])
    return (out.content or "").strip()


def answer(
    question: str,
    history: List[Dict[str, str]],
    lang: Optional[str] = None,
) -> Dict:
    question = (question or "").strip()
    if not question:
        return _fallback(lang or "en")
    if lang not in ("en", "id"):
        lang = detect_lang(question)

    if not _DOCS:
        log.info("no documents loaded -> fallback")
        return _fallback(lang)

    # Resolve follow-ups so the question can stand alone
    standalone = rewrite_standalone(question, history) if history else question

    system = _system_with_docs(lang)
    user_msg = f"QUESTION: {question}"
    if standalone != question:
        user_msg += f"\n(Resolved standalone form: {standalone})"

    log.info("answer | lang=%s | q=%r", lang, question[:80])

    try:
        raw = _generate(system, user_msg)
    except Exception as e:
        log.exception("LLM call failed: %s", e)
        return _fallback(lang)

    if _is_no_answer(raw):
        log.info("first attempt returned NO_ANSWER, retrying with stricter prompt")
        retry_user = (
            f"{user_msg}\n\n"
            "Your previous reply was NO_ANSWER, but the DOCUMENTS above DO contain "
            "facts related to this question. Answer now using whatever is available. "
            "NO_ANSWER is FORBIDDEN in this reply. If only partial details are present, "
            "answer with the partial details and say clearly which specific aspect is not covered."
        )
        try:
            raw = _generate(system, retry_user)
        except Exception as e:
            log.exception("retry LLM call failed: %s", e)
            return _fallback(lang)
        if _is_no_answer(raw):
            log.info("retry also returned NO_ANSWER -> fallback")
            return _fallback(lang)

    return {
        "answer": _strip_sentinel(raw),
        "sources": _sources_listing(),
        "lang": lang,
        "fallback": False,
    }
