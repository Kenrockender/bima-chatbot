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
