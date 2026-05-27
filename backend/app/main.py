import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import rag
from .config import settings
from .db import get_conn, init_db
from .routes_admin import router as admin_router
from .routes_chat import router as chat_router
from .routes_recommender import router as recommender_router
from .routes_training import router as training_router
from .seed import seed_from_dir


log = logging.getLogger("bima.main")


def _load_existing_sources() -> None:
    """Re-hydrate the in-memory document store from sources marked 'ready'
    in SQLite. Runs once at startup so PDFs uploaded in a previous session
    are immediately available without a manual reindex."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, type, origin FROM sources WHERE status='ready'"
        ).fetchall()
    for row in rows:
        sid, name, stype, origin = row["id"], row["name"], row["type"], row["origin"]
        try:
            if stype == "pdf":
                rag.ingest_pdf(sid, name, origin)
            elif stype == "url":
                rag.ingest_url(sid, name, origin)
        except Exception as e:
            log.warning("failed to reload source %s (%s): %s", name, stype, e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    threading.Thread(target=_load_existing_sources, daemon=True).start()
    if settings.seed_dir:
        threading.Thread(
            target=seed_from_dir, args=(settings.seed_dir,), daemon=True
        ).start()
    yield


app = FastAPI(title="BIMA API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(chat_router)
app.include_router(admin_router)
app.include_router(training_router)
app.include_router(recommender_router)
