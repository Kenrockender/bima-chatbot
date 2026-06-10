"""Firestore-backed store for knowledge `sources` (PDFs / URLs).

Replaces the old SQLite layer. The extracted document text lives in the source
document itself (`text` field) so the in-memory RAG cache can be rehydrated at
startup without any local files. PDF text is small — well under Firestore's
1 MiB per-document limit.

Schema — collection `sources`, document id = source id:
  name, type ('pdf'|'url'), origin, status ('processing'|'ready'|'failed'),
  error, page_count, text, created_at, updated_at
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional

from firebase_admin import firestore

from .firebase import fs


_COLLECTION = "sources"


def _now() -> str:
    """ISO 8601 UTC string — keeps lexical ordering and a plain-string schema."""
    return datetime.now(timezone.utc).isoformat()


def _col():
    return fs().collection(_COLLECTION)


def _public(doc) -> Dict:
    """Source dict without the (large) extracted text — for listings."""
    d = doc.to_dict() or {}
    return {
        "id": doc.id,
        "name": d.get("name", ""),
        "type": d.get("type", "pdf"),
        "origin": d.get("origin", ""),
        "status": d.get("status", "processing"),
        "error": d.get("error"),
        "chunk_count": d.get("page_count", 0),
        "created_at": d.get("created_at") or "",
        "updated_at": d.get("updated_at") or "",
    }


def create_source(source_id: str, name: str, source_type: str, origin: str) -> None:
    _col().document(source_id).set({
        "name": name,
        "type": source_type,
        "origin": origin,
        "status": "processing",
        "error": None,
        "page_count": 0,
        "text": "",
        "created_at": _now(),
        "updated_at": _now(),
    })


def set_ready(source_id: str, text: str, page_count: int) -> None:
    _col().document(source_id).update({
        "status": "ready",
        "error": None,
        "text": text,
        "page_count": page_count,
        "updated_at": _now(),
    })


def set_failed(source_id: str, error: str) -> None:
    _col().document(source_id).update({
        "status": "failed",
        "error": error,
        "page_count": 0,
        "updated_at": _now(),
    })


def set_processing(source_id: str) -> None:
    _col().document(source_id).update({
        "status": "processing",
        "error": None,
        "page_count": 0,
        "updated_at": _now(),
    })


def list_sources() -> List[Dict]:
    docs = _col().order_by("created_at", direction=firestore.Query.DESCENDING).stream()
    return [_public(d) for d in docs]


def get_source(source_id: str) -> Optional[Dict]:
    """Full source document including extracted `text`, or None."""
    doc = _col().document(source_id).get()
    if not doc.exists:
        return None
    d = doc.to_dict() or {}
    d["id"] = doc.id
    return d


def delete_source(source_id: str) -> bool:
    ref = _col().document(source_id)
    if not ref.get().exists:
        return False
    ref.delete()
    return True


def list_ready_sources() -> List[Dict]:
    """Ready sources with their extracted text — used to hydrate the cache."""
    docs = _col().where("status", "==", "ready").stream()
    out = []
    for doc in docs:
        d = doc.to_dict() or {}
        d["id"] = doc.id
        out.append(d)
    return out


def existing_pdf_names() -> set:
    docs = _col().where("type", "==", "pdf").stream()
    return {(doc.to_dict() or {}).get("name", "") for doc in docs}
