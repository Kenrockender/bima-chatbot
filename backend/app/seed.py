"""Seed the knowledge base from a local directory tree.

Layout expected (one subfolder per insurer):

    dataset/
      BCA Life/
        heritage-platinum-protection-....pdf
        heritage-platinum-protection-....txt   <- preferred if present
      Prudential/
        prulife-priority-legacy-....pdf
      Manulife/
        ...

The subfolder name becomes the document's `insurer` tag, which lets BIMA group
documents by issuer, compare across products, and stay biased toward BCA Life.

For each product we prefer a curated `.txt` (committed, hand-reviewable, no
extraction variance) and fall back to the `.pdf` only when no `.txt` twin
exists. Loose files directly under the root (no subfolder) are still ingested
with an empty insurer tag for backward compatibility.

Runs at startup if SEED_DIR is set. Idempotent: skips files whose display name
already exists as a source in Firestore.
"""
import os
import uuid

from . import db, rag
from .config import settings  # noqa: F401  (kept for parity / future use)


def _ingest_one(path: str, display_name: str, insurer: str, existing: set) -> bool:
    if display_name in existing:
        return False
    source_id = uuid.uuid4().hex
    is_txt = path.lower().endswith(".txt")
    db.create_source(source_id, display_name, "pdf", display_name, insurer)
    try:
        if is_txt:
            text, pages = rag.read_txt_text(path)
        else:
            text, pages = rag.extract_pdf_text(path)
        if not text.strip():
            db.set_failed(source_id, "No extractable text")
            print(f"[seed] empty {display_name}")
            return False
        db.set_ready(source_id, text, pages)
        rag.register_source(source_id, display_name, "pdf", text, insurer)
        existing.add(display_name)
        print(f"[seed] indexed {display_name} ({insurer or '-'}, {pages} pages, {'txt' if is_txt else 'pdf'})")
        return True
    except Exception as e:
        db.set_failed(source_id, str(e))
        print(f"[seed] failed {display_name}: {e}")
        return False


def _collect(folder: str) -> dict[str, str]:
    """Map display name -> path for a folder, preferring .txt over its .pdf twin."""
    chosen: dict[str, str] = {}
    for entry in sorted(os.listdir(folder)):
        low = entry.lower()
        if not (low.endswith(".pdf") or low.endswith(".txt")):
            continue
        stem = os.path.splitext(entry)[0]
        display_name = f"{stem}.pdf"  # stable name regardless of which twin we load
        path = os.path.join(folder, entry)
        # .txt wins; don't let a later .pdf overwrite a chosen .txt
        if low.endswith(".txt") or display_name not in chosen:
            chosen[display_name] = path
    return chosen


def seed_from_dir(directory: str) -> int:
    if not directory or not os.path.isdir(directory):
        return 0

    existing = db.existing_source_names()
    added = 0

    # Subfolders = insurers.
    for insurer in sorted(os.listdir(directory)):
        folder = os.path.join(directory, insurer)
        if not os.path.isdir(folder):
            continue
        for display_name, path in _collect(folder).items():
            if _ingest_one(path, display_name, insurer, existing):
                added += 1

    # Loose files directly under the root (legacy, no insurer tag).
    for display_name, path in _collect(directory).items():
        if _ingest_one(path, display_name, "", existing):
            added += 1

    return added
