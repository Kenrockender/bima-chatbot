import sqlite3
import os
from contextlib import contextmanager
from .config import settings


SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('pdf', 'url')),
    origin TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('processing', 'ready', 'failed')),
    error TEXT,
    chunk_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Completed roleplay attempts, keyed by an anonymous per-device FA id.
-- This is the backbone of progress tracking, streaks, and adaptive coaching.
CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    fa_id TEXT NOT NULL,
    persona_id TEXT NOT NULL,
    persona_name TEXT NOT NULL,
    drill_id TEXT,
    focus_dimension TEXT,
    rapport INTEGER NOT NULL DEFAULT 0,
    discovery INTEGER NOT NULL DEFAULT 0,
    product_knowledge INTEGER NOT NULL DEFAULT 0,
    objection_handling INTEGER NOT NULL DEFAULT 0,
    closing INTEGER NOT NULL DEFAULT 0,
    overall_score INTEGER NOT NULL DEFAULT 0,
    strengths TEXT NOT NULL DEFAULT '[]',
    improvements TEXT NOT NULL DEFAULT '[]',
    next_focus TEXT NOT NULL DEFAULT '',
    transcript TEXT NOT NULL DEFAULT '[]',
    turn_count INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attempts_fa ON attempts(fa_id, created_at);
"""


def init_db():
    os.makedirs(os.path.dirname(settings.sqlite_path), exist_ok=True)
    with sqlite3.connect(settings.sqlite_path) as conn:
        conn.executescript(SCHEMA)


@contextmanager
def get_conn():
    conn = sqlite3.connect(settings.sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
