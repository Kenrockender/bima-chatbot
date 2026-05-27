"""Personalized product recommender.

Given a customer profile (age, gender, dependents, income, health, budget,
goal, horizon), match against BCA Life products in the knowledge base and
return a ranked list with suggested UP, premium, and tenor.
"""
import json
import logging
import re
from typing import Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from . import rag
from .db import get_conn


log = logging.getLogger("bima.recommender")


# -----------------------------------------------------------------------------
# Product catalog (sourced from SQLite — only "ready" sources count)
# -----------------------------------------------------------------------------

def list_ready_products() -> List[Dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name FROM sources WHERE status='ready' ORDER BY created_at"
        ).fetchall()
    return [{"id": r["id"], "name": r["name"]} for r in rows]


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

SYSTEM = """Kamu senior product advisor BCA Life. Tugasmu: cocokkan profil calon nasabah dengan produk-produk yang tersedia, lalu rekomendasikan UP (Uang Pertanggungan), premi bulanan, dan tenor.

Untuk tiap produk di KATALOG, evaluasi:
- Apakah cocok dengan tujuan & profil nasabah? (skor 1-10)
- UP yang masuk akal (patokan: 5-10x penghasilan tahunan, sesuaikan dengan tanggungan & tujuan)
- Premi bulanan realistik (HARUS dalam budget nasabah)
- Tenor yang cocok (sesuaikan dengan horizon waktu & usia)
- Kelebihan yang relevan untuk nasabah ini
- Concern atau red flag

OUTPUT WAJIB JSON valid, struktur PERSIS:
{
  "customer_summary": "<ringkas profil nasabah 1-2 kalimat>",
  "recommendations": [
    {
      "product_name": "<nama produk PERSIS dari katalog>",
      "fit_score": <integer 1-10>,
      "suggested_up": "<misal: Rp 1.500.000.000>",
      "suggested_premium": "<misal: Rp 3.500.000/bulan>",
      "suggested_tenor": "<misal: 15 tahun>",
      "rationale": ["<alasan 1>", "<alasan 2>", "<alasan 3>"],
      "concerns": ["<concern kalau ada, atau array kosong>"]
    }
  ]
}

Aturan:
- Urutkan recommendations dari fit_score tertinggi ke terendah.
- WAJIB masukkan SEMUA produk dari katalog (bahkan yang fit-score-nya rendah) — supaya FA bisa lihat alternatif.
- Hanya pakai produk dari KATALOG. Dilarang mengarang produk.
- Angka UP/premi/tenor HARUS REASONABLE — perhatikan budget nasabah & informasi dari KATALOG.
- Bahasa Indonesia, alasan dalam kalimat lengkap (bukan satu kata).
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
            "recommendations": [],
            "error": "Knowledge base kosong. Upload PDF produk di /admin dulu.",
        }

    catalog = _catalog_block(products)
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
            "recommendations": [],
            "error": str(e),
        }

    parsed = _extract_json(raw)
    if not parsed:
        log.warning("recommender JSON parse failed; raw=%r", raw[:300])
        return {
            "customer_summary": narrative[:200],
            "recommendations": [],
            "error": "Gagal parsing output AI. Coba ulangi.",
            "raw": raw[:600],
        }

    recs = parsed.get("recommendations", [])
    norm = []
    for r in recs:
        score = r.get("fit_score", 0)
        try:
            score = int(score)
        except Exception:
            score = 0
        score = max(0, min(10, score))
        norm.append({
            "product_name": r.get("product_name", "—"),
            "fit_score": score,
            "suggested_up": r.get("suggested_up", "—"),
            "suggested_premium": r.get("suggested_premium", "—"),
            "suggested_tenor": r.get("suggested_tenor", "—"),
            "rationale": r.get("rationale", []) if isinstance(r.get("rationale"), list) else [],
            "concerns": r.get("concerns", []) if isinstance(r.get("concerns"), list) else [],
        })
    norm.sort(key=lambda x: x["fit_score"], reverse=True)
    return {
        "customer_summary": parsed.get("customer_summary", narrative[:200]),
        "recommendations": norm,
        "profile_echo": profile,
    }
