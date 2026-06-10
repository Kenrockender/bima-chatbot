"""Seed the knowledge base with PDFs from a local directory.

Runs at startup if SEED_DIR is set. Idempotent: skips files whose names already
exist as sources in Firestore.
"""
import os
import uuid

from . import db, rag
from .config import settings  # noqa: F401  (kept for parity / future use)


def seed_from_dir(directory: str) -> int:
    if not directory or not os.path.isdir(directory):
        return 0

    existing = db.existing_pdf_names()
    added = 0
    for entry in sorted(os.listdir(directory)):
        if not entry.lower().endswith(".pdf"):
            continue
        if entry in existing:
            continue

        src_path = os.path.join(directory, entry)
        source_id = uuid.uuid4().hex
        db.create_source(source_id, entry, "pdf", entry)
        try:
            text, pages = rag.extract_pdf_text(src_path)
            if not text.strip():
                db.set_failed(source_id, "No extractable text in PDF")
                print(f"[seed] empty {entry}")
                continue
            db.set_ready(source_id, text, pages)
            rag.register_source(source_id, entry, "pdf", text)
            added += 1
            print(f"[seed] indexed {entry} ({pages} pages)")
        except Exception as e:
            db.set_failed(source_id, str(e))
            print(f"[seed] failed {entry}: {e}")

    return added
