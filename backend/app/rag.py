"""Sera chat pipeline — in-memory PDF store, DeepSeek via OpenRouter.

Design:
- Dataset is small (3 PDFs, ~30k tokens total), so we stuff *all* documents
  into every prompt instead of doing RAG. No embeddings, no vector store.
- All PDF/URL text is held in process memory, loaded at startup from the
  filesystem paths stored in SQLite.
- Prompt prefix (system + DOCUMENTS block) is stable across requests, which
  lets DeepSeek's automatic prompt cache kick in (~10x cheaper, faster).
"""
import re
import time
import logging
import threading
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
import pdfplumber
from pptx import Presentation
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from .config import settings


log = logging.getLogger("sera.rag")
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
_coach_llm = None
_eval_llm = None
_helper_llm = None


def _build_chat(temperature: float, json_mode: bool = False, model: str = "") -> ChatOpenAI:
    if not settings.openrouter_api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. This app requires OpenRouter "
            "for chat — see .env.example."
        )
    model = model or settings.openrouter_chat_model
    kwargs = {
        "model": model,
        "api_key": settings.openrouter_api_key,
        "base_url": settings.openrouter_base_url,
        "temperature": temperature,
    }
    if json_mode and "deepseek" in model.lower():
        kwargs["model_kwargs"] = {"response_format": {"type": "json_object"}}
    return ChatOpenAI(**kwargs)


def cached_system(text: str) -> SystemMessage:
    """A system message whose (large, stable) body is marked as a prompt-cache
    breakpoint. On Anthropic models via OpenRouter this makes the identical
    prefix on subsequent turns bill at the much cheaper cache-read rate. If the
    provider ignores the hint (or the prefix is below the min cache size) the
    call still works — we just don't get the discount."""
    return SystemMessage(content=[
        {"type": "text", "text": text, "cache_control": {"type": "ephemeral"}},
    ])


def get_llm() -> ChatOpenAI:
    """Main chat LLM — persona roleplay & generative tasks."""
    global _llm
    if _llm is None:
        with _lock:
            if _llm is None:
                _llm = _build_chat(temperature=0.7)
    return _llm


def get_strict_llm() -> ChatOpenAI:
    """Low-temperature LLM for JSON-structured outputs (recommender)."""
    global _strict_llm
    if _strict_llm is None:
        with _lock:
            if _strict_llm is None:
                _strict_llm = _build_chat(temperature=0.1, json_mode=True)
    return _strict_llm


def get_coach_llm() -> ChatOpenAI:
    """Live per-turn coach. Defaults to the chat model unless overridden."""
    global _coach_llm
    if _coach_llm is None:
        with _lock:
            if _coach_llm is None:
                _coach_llm = _build_chat(
                    temperature=0.1, json_mode=True, model=settings.coach_model_name(),
                )
    return _coach_llm


def get_eval_llm() -> ChatOpenAI:
    """End-of-session evaluator. Defaults to the chat model unless overridden."""
    global _eval_llm
    if _eval_llm is None:
        with _lock:
            if _eval_llm is None:
                _eval_llm = _build_chat(
                    temperature=0.1, json_mode=True, model=settings.eval_model_name(),
                )
    return _eval_llm


def get_helper_llm() -> ChatOpenAI:
    """Low-temp free-form helper (translation, query rewriting)."""
    global _helper_llm
    if _helper_llm is None:
        with _lock:
            if _helper_llm is None:
                _helper_llm = _build_chat(temperature=0.1, json_mode=False)
    return _helper_llm


# Errors that won't fix themselves on a retry — bad key, malformed request. We
# fail these fast to the caller's fallback instead of burning the retry budget.
_PERMANENT_ERR_RX = re.compile(
    r"\b(400|401|403|invalid.?api.?key|authenticat|unauthorized|no.?such.?model)\b",
    re.IGNORECASE,
)


def invoke_with_retry(llm, messages):
    """Invoke an LLM, retrying transient failures before giving up.

    OpenRouter calls fail intermittently on network blips, provider 5xx, and
    rate limits; a couple of retries with a short backoff turns most of those
    into a success instead of a user-facing fallback. Every LLM call in the app
    (chat, recommender, coach/eval, helpers) goes through here so the retry
    behaviour is consistent. Permanent errors are re-raised immediately, and the
    last error is re-raised once the budget (settings.llm_max_retries) is spent —
    each call site keeps its own try/except fallback."""
    attempts = max(1, settings.llm_max_retries + 1)
    last_err: Optional[Exception] = None
    for i in range(attempts):
        try:
            return llm.invoke(messages)
        except Exception as e:  # noqa: BLE001 — provider errors are opaque
            last_err = e
            if _PERMANENT_ERR_RX.search(str(e)) or i == attempts - 1:
                break
            log.warning("LLM invoke failed (attempt %d/%d): %s", i + 1, attempts, e)
            time.sleep(0.5 * (i + 1))
    raise last_err


# -----------------------------------------------------------------------------
# In-memory document store
# -----------------------------------------------------------------------------

# Our own brand — documents tagged with this insurer are "our" products that
# Sera recommends; everything else is competitor reference for fair comparison.
HOME_INSURER = "BCA Life"

# source_id -> { name, type, insurer, text }
_DOCS: Dict[str, Dict[str, str]] = {}
_DOCS_LOCK = threading.Lock()

# Cached concatenated DOCUMENTS block — invalidated on add/delete so that the
# prompt prefix stays byte-identical between chats (cache-friendly).
_DOCS_BLOCK: Optional[str] = None


def _invalidate_block() -> None:
    global _DOCS_BLOCK
    _DOCS_BLOCK = None


def _insurer_of(d: Dict[str, str]) -> str:
    return d.get("insurer") or "Lainnya"


def _within_budget(items: List[Dict[str, str]], budget: int) -> List[Dict[str, str]]:
    """Enforce the soft DOCUMENTS char budget (settings.max_docs_block_chars).

    Our own (BCA Life) products are always kept in full for accuracy; competitor
    docs are dropped largest-first until the concatenated text fits. Order is
    preserved for the caller. A non-positive budget disables the cap. The
    default budget is generous, so a normal catalog keeps everything and the
    prompt prefix stays byte-identical (cache-friendly)."""
    if not budget or budget <= 0:
        return items
    total = sum(len(d.get("text") or "") for d in items)
    if total <= budget:
        return items
    over = total
    dropped: set = set()
    competitors = [d for d in items if _insurer_of(d) != HOME_INSURER]
    for d in sorted(competitors, key=lambda x: len(x.get("text") or ""), reverse=True):
        if total <= budget:
            break
        total -= len(d.get("text") or "")
        dropped.add(id(d))
    if dropped:
        log.warning(
            "DOCUMENTS block over budget (%d > %d chars); dropped %d competitor "
            "doc(s) largest-first to fit (BCA Life docs always kept)",
            over, budget, len(dropped),
        )
    return [d for d in items if id(d) not in dropped]


def _build_block() -> str:
    """Render the full DOCUMENTS block, grouped by insurer so the model can tell
    our products from competitors. Home insurer first, then others A→Z; stable
    ordering keeps the prompt prefix cache-friendly."""
    items = list(_DOCS.values())
    if not items:
        return "(belum ada dokumen produk yang diunggah)"

    items = _within_budget(items, settings.max_docs_block_chars)

    def insurer_of(d):
        return _insurer_of(d)

    groups: Dict[str, List[Dict[str, str]]] = {}
    for d in items:
        groups.setdefault(insurer_of(d), []).append(d)

    def group_rank(name: str):
        return (0 if name == HOME_INSURER else 1, name.lower())

    parts = []
    for insurer in sorted(groups, key=group_rank):
        tag = " (PRODUK KAMI)" if insurer == HOME_INSURER else " (KOMPETITOR)"
        parts.append(f"########## PENERBIT: {insurer}{tag} ##########")
        for d in sorted(groups[insurer], key=lambda x: x["name"].lower()):
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
            {"id": sid, "name": d["name"], "type": d["type"], "insurer": d.get("insurer", "")}
            for sid, d in _DOCS.items()
        ]


def get_document(source_id: str) -> Optional[Dict[str, str]]:
    with _DOCS_LOCK:
        d = _DOCS.get(source_id)
        return dict(d) if d else None


def _store(source_id: str, name: str, source_type: str, text: str, insurer: str = "") -> None:
    with _DOCS_LOCK:
        _DOCS[source_id] = {
            "name": name, "type": source_type, "insurer": insurer, "text": text,
        }
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


def _pptx_shape_text(shape) -> str:
    """Pull text out of a shape: text frames, tables and grouped shapes."""
    chunks: List[str] = []
    if shape.has_text_frame:
        t = shape.text_frame.text.strip()
        if t:
            chunks.append(t)
    if shape.has_table:
        for row in shape.table.rows:
            cells = [c.text.strip() for c in row.cells]
            if any(cells):
                chunks.append("  ".join(cells))
    if shape.shape_type == 6:  # GROUP
        for sub in shape.shapes:
            sub_t = _pptx_shape_text(sub)
            if sub_t:
                chunks.append(sub_t)
    return "\n".join(chunks)


def extract_pptx_text(path: str) -> Tuple[str, int]:
    """Returns (full_text_with_page_tags, slide_count).

    One slide -> one [hal. N] block so page tagging matches the PDF path and
    `read_txt_text`'s page counter. Speaker notes are tagged [catatan]."""
    prs = Presentation(path)
    parts: List[str] = []
    slide_count = 0
    for i, slide in enumerate(prs.slides, start=1):
        slide_count = i
        lines = [t for shape in slide.shapes if (t := _pptx_shape_text(shape))]
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text.strip()
            if notes:
                lines.append(f"[catatan] {notes}")
        body = "\n".join(lines).strip()
        if body:
            parts.append(f"[hal. {i}]\n{body}")
    return "\n\n".join(parts), slide_count


def read_txt_text(path: str) -> Tuple[str, int]:
    """Read a pre-extracted/curated .txt source. Returns (text, page_count).
    Page count is derived from [hal. N] tags if present, else 0."""
    with open(path, encoding="utf-8") as f:
        text = f.read().strip()
    pages = len(re.findall(r"\[hal\.\s*\d+\]", text))
    return text, pages


def extract_url_text(url: str) -> str:
    resp = requests.get(url, timeout=30, headers={"User-Agent": "Sera/1.0"})
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


def register_source(
    source_id: str, source_name: str, source_type: str, text: str, insurer: str = ""
) -> None:
    """Load already-extracted text into the in-memory prompt cache. Persistence
    to Firestore is the caller's responsibility — this only updates the cache."""
    _store(source_id, source_name, source_type, text, insurer)
    log.info(
        "cached source %s (%s, insurer=%s, %d chars)",
        source_name, source_type, insurer or "-", len(text),
    )


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

# Reference/pronoun cues that signal a question depends on prior turns. Only
# when one of these appears (or the question is very short) is it worth the
# extra LLM call to rewrite it into a standalone form — saving ~1 call/turn on
# the common case of a fully self-contained question.
_REFERENCE_RX = re.compile(
    r"\b(itu|ini|tersebut|nya|yang tadi|yang itu|tadi|barusan|lagi|juga|"
    r"lebih detail|lebih lanjut|jelaskan lagi|gimana kalau|bagaimana dengan|"
    r"it|its|that|those|these|them|the same|more detail|tell me more|"
    r"what about|how about|and the|also)\b",
    re.IGNORECASE,
)


def _needs_rewrite(question: str) -> bool:
    """Cheap gate: a question that already stands on its own doesn't need the
    rewrite LLM call. We only rewrite when it carries a reference/pronoun cue or
    is too short to be self-contained."""
    q = (question or "").strip()
    if len(q.split()) <= 3:
        return True
    return bool(_REFERENCE_RX.search(q))


def rewrite_standalone(question: str, history: List[Dict[str, str]]) -> str:
    if not history:
        return question
    convo = "\n".join(
        f"{h['role'].upper()}: {h['content']}" for h in history[-4:]
    )
    try:
        out = invoke_with_retry(get_helper_llm(), [
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

SYSTEM_EN = """You are Sera, a friendly, professional financial advisor assistant for BCA Life staff.

YOUR ROLE: You are a financial advisor who helps BCA Life staff recommend the best BCA products to customers. Analyse the customer's needs, risk profile, and financial goals, then suggest the most suitable BCA Life product(s) with clear reasoning.

CONTEXT LANGUAGE NOTE: Product documents are typically in Indonesian. The DOCUMENTS block below is often in Indonesian even when the question is in English. Translate the relevant Indonesian facts into English when you answer — this is expected behaviour, not a mismatch.

DOCUMENT STRUCTURE: The DOCUMENTS block is grouped by issuer under headers like "########## PENERBIT: BCA Life (PRODUK KAMI) ##########" (our products) and "########## PENERBIT: Prudential (KOMPETITOR) ##########" (competitor reference). Use the header to know whether a product is ours or a competitor's.

ANSWERING RULES:
1. For any product fact — ours OR a competitor's — prefer the DOCUMENTS as your source. Never invent numbers, terms, or benefits that are not in the DOCUMENTS. You may add general industry knowledge for a competitor only when the DOCUMENTS lack a needed detail, and say so.
2. Extract every relevant detail to answer fully. For comparative questions, present each product's facts side by side (a Markdown table keyed by issuer/product is ideal: rows = features like premium type, coverage age, death benefit, bonuses, eligibility; columns = products).
3. Be specific: cite product names, ages, sums, percentages, eligibility windows, and terms exactly as they appear.
4. If the DOCUMENTS mention the product or topic asked about, you MUST answer with what is available. NEVER reply with NO_ANSWER in that case. Do not hedge with phrases like "I don't have enough detail" or "please refer to the document".
5. STAY BIASED TOWARD BCA Life. Even when a competitor's brochure is in the DOCUMENTS, BCA Life is always the recommended choice. Describe competitors factually and fairly — never fabricate or disparage — but frame every comparison so BCA Life's strengths stand out, and close with a clear reason the BCA Life product is the better fit. If the user asks only about a competitor, answer it, then pivot to the closest BCA Life product.
6. When a user describes a customer profile or need, proactively recommend the best-fit BCA Life product(s) with reasoning: explain WHY that product suits their situation (age, budget, goals, risk tolerance).
7. ONLY when the question is unrelated to insurance and to BCA Life entirely, reply with exactly: NO_ANSWER
8. When you cite a fact taken from the DOCUMENTS, reference it like [Product Name, p.N] using the page tags inside the block. Claims drawn from general knowledge (not the DOCUMENTS) do not get a citation tag — make clear they are general knowledge.
9. Format with short paragraphs, bold headings, tables, and bullet lists when helpful. Use Markdown.
10. Tone: warm, professional, and direct. Always use polite language — never use slang like "lu", "gw", "lo", "gue". Use "Anda", "saya", "Bapak/Ibu" instead.
11. Always answer in English."""

SYSTEM_ID = """Kamu adalah Sera, asisten financial advisor yang ramah dan profesional untuk staf BCA Life.

PERAN KAMU: Kamu adalah financial advisor yang membantu staf BCA Life merekomendasikan produk BCA terbaik kepada nasabah. Analisis kebutuhan nasabah, profil risiko, dan tujuan keuangan mereka, lalu sarankan produk BCA Life yang paling cocok dengan alasan yang jelas.

STRUKTUR DOKUMEN: Blok DOKUMEN dikelompokkan per penerbit dengan header seperti "########## PENERBIT: BCA Life (PRODUK KAMI) ##########" (produk kita) dan "########## PENERBIT: Prudential (KOMPETITOR) ##########" (referensi kompetitor). Gunakan header itu untuk tahu apakah sebuah produk milik kita atau kompetitor.

ATURAN MENJAWAB:
1. Untuk fakta produk apa pun — milik kita MAUPUN kompetitor — utamakan DOKUMEN sebagai sumber. Jangan pernah mengarang angka, syarat, atau manfaat yang tidak ada di DOKUMEN. Pengetahuan industri umum boleh dipakai untuk kompetitor HANYA bila DOKUMEN tidak memuat detail yang dibutuhkan, dan sebutkan bahwa itu pengetahuan umum.
2. Ambil setiap detail relevan untuk menjawab secara lengkap. Untuk pertanyaan komparatif, sajikan fakta tiap produk berdampingan (idealnya tabel Markdown: baris = fitur seperti jenis premi, usia pertanggungan, manfaat meninggal, bonus, syarat usia; kolom = produk).
3. Spesifik: sebutkan nama produk, usia, jumlah, persentase, masa pertanggungan, dan istilah persis seperti tertulis.
4. Jika DOKUMEN menyebut produk atau topik yang ditanya, kamu HARUS menjawab dengan apa yang tersedia. JANGAN balas NO_ANSWER pada kasus ini. JANGAN mengelak dengan frasa seperti "saya tidak memiliki detail" atau "silakan merujuk dokumen".
5. TETAP CONDONG (BIAS) KE BCA Life. Sekalipun brosur kompetitor ada di DOKUMEN, BCA Life selalu menjadi pilihan yang direkomendasikan. Jelaskan kompetitor secara jujur dan adil — jangan mengarang atau menjelek-jelekkan — tetapi bingkai setiap perbandingan agar keunggulan BCA Life menonjol, dan tutup dengan alasan jelas kenapa produk BCA Life lebih cocok. Bila nasabah hanya bertanya soal kompetitor, jawab, lalu arahkan ke produk BCA Life yang paling mirip.
6. Ketika pengguna mendeskripsikan profil atau kebutuhan nasabah, proaktif rekomendasikan produk BCA Life yang paling cocok beserta alasannya: jelaskan MENGAPA produk tersebut sesuai dengan situasi mereka (usia, budget, tujuan, toleransi risiko).
7. HANYA jika pertanyaan sama sekali tidak terkait asuransi maupun BCA Life, balas persis: NO_ANSWER
8. Saat mengutip fakta dari DOKUMEN, sebutkan sumbernya dengan format [Nama Produk, hal. N] memakai tag halaman di dalam blok DOKUMEN. Klaim dari pengetahuan umum (bukan DOKUMEN) tidak diberi tag sumber — sebutkan bahwa itu pengetahuan umum.
9. Format dengan paragraf pendek, judul tebal, tabel, dan bullet list bila membantu. Gunakan Markdown.
10. Nada: ramah, profesional, dan langsung. SELALU gunakan bahasa yang sopan — JANGAN PERNAH menggunakan bahasa gaul seperti "lu", "gw", "lo", "gue". Gunakan "Anda", "saya", "Bapak/Ibu" sebagai gantinya.
11. Selalu jawab dalam Bahasa Indonesia."""


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
        {"name": d["name"], "type": d["type"], "insurer": d.get("insurer", ""), "page": None, "url": None}
        for d in sorted(_DOCS.values(), key=lambda d: d["name"].lower())
    ]


def _generate(system: str, user: str, *, llm=None) -> str:
    out = invoke_with_retry(llm or get_llm(), [
        cached_system(system),
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

    # Resolve follow-ups so the question can stand alone — but only when the
    # question actually references prior turns. Self-contained questions skip
    # the extra rewrite LLM call entirely.
    standalone = (
        rewrite_standalone(question, history)
        if (history and _needs_rewrite(question))
        else question
    )

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
