"""Personalized product recommender.

Given a customer profile (age, gender, dependents, income, health, budget,
goal, horizon), match against BCA Life products in the knowledge base and
return a ranked list with suggested UP, premium, and tenor.
"""
import json
import logging
import os
import re
from typing import Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from . import rag
from . import db
from .config import settings


log = logging.getLogger("bima.recommender")


# -----------------------------------------------------------------------------
# Condensed fact sheets (token-saving). For each product we prefer a curated
# `<stem>.md` fact sheet sitting next to its seed file over the full brochure
# text. The full text still feeds chat RAG; the recommender only needs the key
# figures, so a 1-page sheet keeps the catalog (injected every call) cheap.
# -----------------------------------------------------------------------------

def _factsheet_dirs() -> List[str]:
    dirs = []
    if settings.seed_dir:
        dirs.append(settings.seed_dir)
    # Repo-relative fallback so local runs (SEED_DIR unset) still find sheets.
    dirs.append(os.path.join(os.path.dirname(__file__), "..", "seed"))
    return [d for d in dirs if os.path.isdir(d)]


def _factsheet_for(name: str) -> Optional[str]:
    """Return the curated .md fact sheet for a source display name, if present."""
    stem = os.path.splitext(name)[0].strip().lower()
    target = f"{stem}.md"
    for base in _factsheet_dirs():
        for root, _, files in os.walk(base):
            for f in files:
                if f.lower() == target:
                    try:
                        with open(os.path.join(root, f), encoding="utf-8") as fh:
                            text = fh.read().strip()
                        if text:
                            return text
                    except OSError:
                        pass
    return None


# -----------------------------------------------------------------------------
# Product catalog (sourced from SQLite — only "ready" sources count)
# -----------------------------------------------------------------------------

def list_ready_products() -> List[Dict]:
    return [{"id": s["id"], "name": s.get("name", "")} for s in db.list_ready_sources()]


def _pretty_name(name: str) -> str:
    """Turn a raw seed/file display name into something FA-friendly for a dropdown."""
    stem = os.path.splitext(name)[0]
    return re.sub(r"\s{2,}", " ", stem).strip()


def list_competitor_sources() -> List[Dict]:
    """Ready competitor docs (insurer != BCA Life) for the comparison dropdown,
    grouped-friendly: each carries its insurer so the UI can section them."""
    out: List[Dict] = []
    for s in db.list_ready_sources():
        insurer = (s.get("insurer") or "").strip()
        if not insurer or insurer == rag.HOME_INSURER:
            continue
        out.append({
            "id": s["id"],
            "name": s.get("name", ""),
            "label": _pretty_name(s.get("name", "")),
            "insurer": insurer,
        })
    out.sort(key=lambda x: (x["insurer"].lower(), x["label"].lower()))
    return out


def _text_for_source(source_id: str = "", name: str = "") -> str:
    """Best available text for a product: prefer the condensed .md fact sheet,
    fall back to the cached/extracted full document text."""
    if name:
        sheet = _factsheet_for(name)
        if sheet:
            return sheet
    if source_id:
        doc = rag.get_document(source_id)
        if doc:
            sheet = _factsheet_for(doc.get("name", ""))
            if sheet:
                return sheet
            return (doc.get("text") or "").strip()
    return ""


# -----------------------------------------------------------------------------
# Customer narrative
# -----------------------------------------------------------------------------

def build_narrative(p: Dict) -> str:
    parts: List[str] = []
    if p.get("name"):
        parts.append(f"Nama: {p['name']}.")
    parts.append(f"Usia {p.get('age', '-')} tahun, {p.get('gender', '-')}.")
    if p.get("marital"):
        parts.append(f"Status: {p['marital']}.")
    if p.get("dependents") is not None:
        parts.append(f"Tanggungan: {p['dependents']} orang.")
    if p.get("income_per_month"):
        parts.append(f"Penghasilan: Rp {p['income_per_month']} juta/bulan.")
    if p.get("health_notes"):
        parts.append(f"Kesehatan: {p['health_notes']}.")
    if p.get("budget_premium_per_month"):
        parts.append(
            f"Budget premi: Rp {p['budget_premium_per_month']} juta/bulan."
        )
    if p.get("goal"):
        parts.append(f"Tujuan utama: {p['goal']}.")
    if p.get("horizon_years"):
        parts.append(f"Horizon waktu: {p['horizon_years']} tahun.")
    if p.get("notes"):
        parts.append(f"Catatan: {p['notes']}")
    return " ".join(parts)


# -----------------------------------------------------------------------------
# Prompt
# -----------------------------------------------------------------------------

SYSTEM = """Kamu senior product advisor BCA Life yang juga memahami produk asuransi kompetitor (Manulife, Prudential, AIA, MSIG Life). Tugasmu:
1. Cocokkan profil nasabah dengan produk BCA Life in-branch (Heritage+, Prosper, Star) dari KATALOG.
2. Bandingkan dengan produk sejenis dari Manulife, Prudential, AIA & MSIG Life.
3. Buatkan skrip jualan lengkap untuk FA menjual produk BCA Life terbaik, termasuk keunggulan vs kompetitor.

BAGIAN A — REKOMENDASI BCA LIFE (dari KATALOG):
Untuk tiap produk BCA Life di KATALOG:
- Skor kecocokan 1-10
- UP (patokan: 5-10x penghasilan tahunan)
- Premi bulanan (HARUS dalam budget nasabah)
- Tenor
- Alasan & concern

BAGIAN B — PERBANDINGAN KOMPETITOR:
Untuk tiap produk kompetitor yang SEJENIS dengan rekomendasi BCA Life terbaik:
- Nama provider & produk
- Produk BCA Life mana yang dibandingkan
- Skor kecocokan 1-10
- Kelebihan produk kompetitor
- Kelemahan dibanding BCA Life (kenapa BCA Life lebih baik)

BAGIAN C — SKRIP JUALAN FA:
Buatkan skrip lengkap untuk FA menjual produk BCA Life terbaik:
- Pembukaan (salam + ice breaking)
- Pertanyaan discovery (3-4 pertanyaan menggali kebutuhan)
- Pitch produk (penjelasan manfaat sesuai kebutuhan nasabah)
- Keunggulan vs kompetitor (3-5 poin konkret kenapa BCA Life lebih baik)
- Handling keberatan (3 keberatan umum + respons)
- Closing (ajakan action)

OUTPUT WAJIB JSON valid, struktur PERSIS:
{
  "customer_summary": "<ringkas profil nasabah 1-2 kalimat>",
  "bca_recommendations": [
    {
      "product_name": "<nama produk PERSIS dari katalog>",
      "fit_score": <integer 1-10>,
      "suggested_up": "<misal: Rp 1.500.000.000>",
      "suggested_premium": "<misal: Rp 3.500.000/bulan>",
      "suggested_tenor": "<misal: 15 tahun>",
      "rationale": ["<alasan 1>", "<alasan 2>", "<alasan 3>"],
      "concerns": ["<concern kalau ada, atau array kosong>"]
    }
  ],
  "competitor_comparisons": [
    {
      "provider": "<Manulife, Prudential, AIA, atau MSIG Life>",
      "product_name": "<nama produk kompetitor>",
      "similar_to": "<nama produk BCA Life yang dibandingkan>",
      "fit_score": <integer 1-10>,
      "strengths": ["<kelebihan kompetitor 1>", "<kelebihan 2>"],
      "weaknesses_vs_bca": ["<kelemahan vs BCA Life 1>", "<kelemahan 2>"]
    }
  ],
  "sales_script": {
    "best_product": "<nama produk BCA Life terbaik>",
    "opening": "<pembukaan + ice breaking 2-3 kalimat>",
    "discovery_questions": ["<pertanyaan 1>", "<pertanyaan 2>", "<pertanyaan 3>"],
    "pitch": "<pitch produk 3-5 kalimat, sesuai kebutuhan nasabah>",
    "competitive_advantages": ["<keunggulan vs kompetitor 1>", "<keunggulan 2>", "<keunggulan 3>"],
    "objection_handling": [
      {"objection": "<keberatan umum>", "response": "<respons FA>"}
    ],
    "closing": "<kalimat closing + ajakan action>"
  }
}

Aturan:
- bca_recommendations: urutkan dari fit_score tertinggi. WAJIB masukkan SEMUA produk dari KATALOG.
- competitor_comparisons: minimal 2 produk dari provider berbeda (Manulife, Prudential, AIA, atau MSIG Life) yang paling sejenis dengan best BCA Life product. Hanya sertakan produk kompetitor yang ada di KATALOG.
- sales_script: harus spesifik untuk profil nasabah ini, bukan generik.
- Angka UP/premi/tenor HARUS REASONABLE.
- Bahasa Indonesia, kalimat lengkap.
- JANGAN output text di luar JSON. JANGAN pakai markdown fence."""


def _extract_json(text: str) -> Optional[Dict]:
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text.strip())
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def _catalog_block(products: List[Dict]) -> str:
    """Render each product's full text. The catalog is the *same* across
    every recommend() call, so it sits in the cache-friendly system prefix."""
    blocks: List[str] = []
    for p in products:
        text = _factsheet_for(p["name"])
        if not text:
            doc = rag.get_document(p["id"])
            text = (doc or {}).get("text", "").strip() or "(brosur belum dimuat)"
        blocks.append(f"=== PRODUK: {p['name']}\n{text}")
    return "\n\n".join(blocks)


def recommend(profile: Dict) -> Dict:
    narrative = build_narrative(profile)
    products = list_ready_products()
    if not products:
        return {
            "customer_summary": narrative[:200],
            "bca_recommendations": [],
            "competitor_comparisons": [],
            "sales_script": None,
            "error": "Knowledge base kosong. Upload PDF produk di /admin dulu.",
        }

    try:
        catalog = _catalog_block(products)
    except Exception as e:
        log.exception("catalog block failed: %s", e)
        return {
            "customer_summary": narrative[:200],
            "bca_recommendations": [],
            "competitor_comparisons": [],
            "sales_script": None,
            "error": f"Gagal memuat katalog produk: {e}",
        }

    system = f"{SYSTEM}\n\nKATALOG PRODUK BCA LIFE:\n{catalog}"
    user_msg = f"""PROFIL CALON NASABAH:
{narrative}

Berikan rekomendasi JSON sesuai format yang diminta."""

    try:
        out = rag.get_strict_llm().invoke([
            SystemMessage(content=system),
            HumanMessage(content=user_msg),
        ])
        raw = (out.content or "").strip()
    except Exception as e:
        log.exception("recommend LLM failed: %s", e)
        return {
            "customer_summary": narrative[:200],
            "bca_recommendations": [],
            "competitor_comparisons": [],
            "sales_script": None,
            "error": str(e),
        }

    parsed = _extract_json(raw)
    if not parsed:
        log.warning("recommender JSON parse failed; raw=%r", raw[:300])
        return {
            "customer_summary": narrative[:200],
            "bca_recommendations": [],
            "competitor_comparisons": [],
            "sales_script": None,
            "error": "Gagal parsing output AI. Coba ulangi.",
            "raw": raw[:600],
        }

    def _norm_score(val):
        try:
            s = int(val)
        except Exception:
            s = 0
        return max(0, min(10, s))

    def _as_list(val):
        return val if isinstance(val, list) else []

    bca_recs = parsed.get("bca_recommendations") or parsed.get("recommendations") or []
    norm_bca = []
    for r in bca_recs:
        norm_bca.append({
            "product_name": r.get("product_name", "—"),
            "fit_score": _norm_score(r.get("fit_score", 0)),
            "suggested_up": r.get("suggested_up", "—"),
            "suggested_premium": r.get("suggested_premium", "—"),
            "suggested_tenor": r.get("suggested_tenor", "—"),
            "rationale": _as_list(r.get("rationale")),
            "concerns": _as_list(r.get("concerns")),
        })
    norm_bca.sort(key=lambda x: x["fit_score"], reverse=True)

    comp_recs = parsed.get("competitor_comparisons") or []
    norm_comp = []
    for c in comp_recs:
        norm_comp.append({
            "provider": c.get("provider", "—"),
            "product_name": c.get("product_name", "—"),
            "similar_to": c.get("similar_to", "—"),
            "fit_score": _norm_score(c.get("fit_score", 0)),
            "strengths": _as_list(c.get("strengths")),
            "weaknesses_vs_bca": _as_list(c.get("weaknesses_vs_bca")),
        })

    script = parsed.get("sales_script") or {}
    norm_script = None
    if script:
        objections = script.get("objection_handling") or []
        norm_obj = [
            {"objection": o.get("objection", ""), "response": o.get("response", "")}
            for o in objections if isinstance(o, dict)
        ]
        norm_script = {
            "best_product": script.get("best_product", "—"),
            "opening": script.get("opening", ""),
            "discovery_questions": _as_list(script.get("discovery_questions")),
            "pitch": script.get("pitch", ""),
            "competitive_advantages": _as_list(script.get("competitive_advantages")),
            "objection_handling": norm_obj,
            "closing": script.get("closing", ""),
        }

    return {
        "customer_summary": parsed.get("customer_summary", narrative[:200]),
        "bca_recommendations": norm_bca,
        "competitor_comparisons": norm_comp,
        "sales_script": norm_script,
        "profile_echo": profile,
    }


# -----------------------------------------------------------------------------
# Head-to-head / complementary comparison vs a single competitor document
# -----------------------------------------------------------------------------

COMPARE_SYSTEM = """Kamu senior product advisor BCA Life yang menyiapkan bahan untuk Financial Advisor (FA) BCA Life membandingkan SATU produk BCA Life dengan SATU produk kompetitor, berdasarkan dokumen (RIPLAY/brosur/fact sheet) yang diberikan.

Ada DUA skenario:
1. "head_to_head" — kedua produk JENIS yang sama / bersaing langsung (mis. dua asuransi jiwa dwiguna). Tugas: bandingkan spek, ilustrasi, dan manfaat secara apple-to-apple, lalu tonjolkan di mana BCA Life unggul.
2. "complementary" — kedua produk BEDA jenis (mis. STAR = penyakit kritis vs asuransi kesehatan kompetitor). Tugas: jelaskan bahwa keduanya tidak menggantikan satu sama lain; tonjolkan keunggulan BCA Life DAN bagaimana produk BCA Life MELENGKAPI proteksi yang sudah dimiliki nasabah, serta celah yang ditinggalkan produk kompetitor.

Tentukan "relationship" sendiri dari kedua dokumen KECUALI diberi MODE eksplisit (head_to_head / complementary) — kalau ada MODE, ikuti itu.

Bersikap JUJUR soal kelebihan kompetitor, tapi framing tetap pro-BCA Life (kamu membantu FA BCA Life menang). Hanya gunakan fakta dari dokumen; jika sebuah angka tidak ada di dokumen, tulis "—" dan JANGAN mengarang.

OUTPUT WAJIB JSON valid, struktur PERSIS (tanpa teks lain, tanpa markdown fence):
{
  "relationship": "head_to_head" | "complementary",
  "relationship_reason": "<1 kalimat kenapa>",
  "bca": {"name": "<nama produk BCA Life>", "type": "<jenis>", "one_liner": "<positioning 1 kalimat>"},
  "competitor": {"name": "<nama produk kompetitor>", "provider": "<penanggung>", "type": "<jenis>", "one_liner": "<positioning 1 kalimat>"},
  "spec_rows": [
    {"dimension": "<aspek, mis. Jenis, Mata uang, Masa Pertanggungan, Premi, UP, Manfaat utama>", "bca": "<nilai BCA Life>", "competitor": "<nilai kompetitor>", "advantage": "bca" | "competitor" | "tie"}
  ],
  "bca_advantages": ["<keunggulan konkret BCA Life 1>", "..."],
  "competitor_advantages": ["<kelebihan jujur kompetitor 1>", "..."],
  "complement": {
    "narrative": "<kosong '' kalau head_to_head; kalau complementary: 2-3 kalimat bagaimana BCA Life melengkapi>",
    "how_bca_completes": ["<cara BCA Life melengkapi proteksi nasabah>", "..."],
    "gaps_competitor_leaves": ["<celah/risiko yang TIDAK ditutup produk kompetitor>", "..."]
  },
  "talking_points": ["<kalimat siap-pakai untuk FA saat menjelaskan ke nasabah>", "..."],
  "summary": "<rekomendasi ringkas 1-2 kalimat untuk FA>"
}

Aturan:
- spec_rows: 5-8 baris paling relevan; untuk head_to_head usahakan apple-to-apple, untuk complementary boleh menyoroti perbedaan cakupan.
- bca_advantages: 3-5 poin. competitor_advantages: 1-4 poin (jujur).
- Kalau head_to_head: complement.narrative = "" dan boleh kosongkan how_bca_completes & gaps_competitor_leaves.
- Kalau complementary: WAJIB isi complement dengan baik.
- Bahasa Indonesia, kalimat lengkap. JANGAN output di luar JSON."""


def _norm_compare(parsed: Dict) -> Dict:
    def _as_list(v):
        return [str(x) for x in v] if isinstance(v, list) else []

    rel = parsed.get("relationship")
    if rel not in ("head_to_head", "complementary"):
        rel = "head_to_head"

    def _side(d, default_provider=""):
        d = d if isinstance(d, dict) else {}
        return {
            "name": d.get("name", "—"),
            "provider": d.get("provider", default_provider),
            "type": d.get("type", "—"),
            "one_liner": d.get("one_liner", ""),
        }

    rows = []
    for r in (parsed.get("spec_rows") or []):
        if not isinstance(r, dict):
            continue
        adv = r.get("advantage")
        if adv not in ("bca", "competitor", "tie"):
            adv = "tie"
        rows.append({
            "dimension": r.get("dimension", "—"),
            "bca": r.get("bca", "—"),
            "competitor": r.get("competitor", "—"),
            "advantage": adv,
        })

    comp = parsed.get("complement") if isinstance(parsed.get("complement"), dict) else {}
    return {
        "relationship": rel,
        "relationship_reason": parsed.get("relationship_reason", ""),
        "bca": _side(parsed.get("bca"), "BCA Life"),
        "competitor": _side(parsed.get("competitor")),
        "spec_rows": rows,
        "bca_advantages": _as_list(parsed.get("bca_advantages")),
        "competitor_advantages": _as_list(parsed.get("competitor_advantages")),
        "complement": {
            "narrative": comp.get("narrative", "") if isinstance(comp, dict) else "",
            "how_bca_completes": _as_list(comp.get("how_bca_completes")) if isinstance(comp, dict) else [],
            "gaps_competitor_leaves": _as_list(comp.get("gaps_competitor_leaves")) if isinstance(comp, dict) else [],
        },
        "talking_points": _as_list(parsed.get("talking_points")),
        "summary": parsed.get("summary", ""),
    }


def compare(
    competitor_id: str,
    bca_name: str = "",
    bca_stem: str = "",
    mode: str = "auto",
) -> Dict:
    """Compare one BCA Life product against one competitor document.

    The BCA side is resolved from its condensed fact sheet (by display name or
    file stem); the competitor side from its ingested source id. Mode "auto"
    lets the model decide head_to_head vs complementary; otherwise it is forced.
    """
    bca_text = _text_for_source(name=bca_name) or _text_for_source(name=bca_stem)
    comp_doc = rag.get_document(competitor_id)
    if not comp_doc:
        return {"error": "Dokumen kompetitor tidak ditemukan. Pastikan sudah di-ingest."}
    comp_text = _text_for_source(source_id=competitor_id, name=comp_doc.get("name", ""))
    if not bca_text:
        return {"error": "Fact sheet produk BCA Life tidak ditemukan."}
    if not comp_text:
        return {"error": "Teks dokumen kompetitor kosong."}

    mode_line = ""
    if mode in ("head_to_head", "complementary"):
        mode_line = f"\nMODE WAJIB: {mode} (abaikan deteksi otomatis, gunakan skenario ini)."

    user_msg = (
        f"PRODUK BCA LIFE (PRODUK KAMI):\n{bca_text}\n\n"
        f"PRODUK KOMPETITOR ({comp_doc.get('insurer', '-')}):\n{comp_text}\n"
        f"{mode_line}\n\nBuatkan perbandingan JSON sesuai format yang diminta."
    )

    try:
        out = rag.get_strict_llm().invoke([
            SystemMessage(content=COMPARE_SYSTEM),
            HumanMessage(content=user_msg),
        ])
        raw = (out.content or "").strip()
    except Exception as e:
        log.exception("compare LLM failed: %s", e)
        return {"error": str(e)}

    parsed = _extract_json(raw)
    if not parsed:
        log.warning("compare JSON parse failed; raw=%r", raw[:300])
        return {"error": "Gagal parsing output AI. Coba ulangi.", "raw": raw[:600]}

    result = _norm_compare(parsed)
    result["competitor_source"] = {
        "id": competitor_id,
        "insurer": comp_doc.get("insurer", ""),
        "name": comp_doc.get("name", ""),
    }
    return result
