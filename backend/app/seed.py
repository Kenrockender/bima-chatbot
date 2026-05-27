"""Seed the knowledge base with PDFs from a local directory.

Runs at startup if SEED_DIR is set and not yet seeded. Idempotent: skips
files whose names already exist as sources in SQLite.
"""
import os
import uuid
from .config import settings
from .db import get_conn
from . import rag


def seed_from_dir(directory: str) -> int:
    if not directory or not os.path.isdir(directory):
        return 0

    with get_conn() as conn:
        existing = {
            row["name"]
            for row in conn.execute("SELECT name FROM sources WHERE type='pdf'").fetchall()
        }

    added = 0
    for entry in sorted(os.listdir(directory)):
        if not entry.lower().endswith(".pdf"):
            continue
        if entry in existing:
            continue

        src_path = os.path.join(directory, entry)
        source_id = uuid.uuid4().hex

        with get_conn() as conn:
            conn.execute(
                "INSERT INTO sources (id, name, type, origin, status) VALUES (?, ?, 'pdf', ?, 'processing')",
                (source_id, entry, src_path),
            )

        try:
            n = rag.ingest_pdf(source_id, entry, src_path)
            with get_conn() as conn:
                conn.execute(
                    "UPDATE sources SET status='ready', chunk_count=?, updated_at=datetime('now') WHERE id=?",
                    (n, source_id),
                )
            added += 1
            print(f"[seed] indexed {entry} ({n} chunks)")
        except Exception as e:
            with get_conn() as conn:
                conn.execute(
                    "UPDATE sources SET status='failed', error=?, updated_at=datetime('now') WHERE id=?",
                    (str(e), source_id),
                )
            print(f"[seed] failed {entry}: {e}")

    return added
