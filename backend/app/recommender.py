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

SYSTEM = """Kamu senior product advisor BCA Life yang juga memahami produk asuransi kompetitor (Manulife, Prudential, AIA). Tugasmu:
1. Cocokkan profil nasabah dengan produk BCA Life in-branch (Heritage+, Prosper, Star) dari KATALOG.
2. Bandingkan dengan produk sejenis dari Manulife, Prudential & AIA.
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
      "provider": "<Manulife, Prudential, atau AIA>",
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
- competitor_comparisons: minimal 2 produk dari provider berbeda (Manulife, Prudential, atau AIA) yang paling sejenis dengan best BCA Life product. Hanya sertakan produk kompetitor yang ada di KATALOG.
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
