import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db, rag
from .config import settings
from .routes_admin import router as admin_router
from .routes_chat import router as chat_router
from .routes_recommender import router as recommender_router
from .routes_training import router as training_router
from .seed import seed_from_dir


log = logging.getLogger("sera.main")


def _load_existing_sources() -> None:
    """Re-hydrate the in-memory document store from Firestore sources marked
    'ready'. Runs once at startup so previously-uploaded PDFs are immediately
    available without re-uploading. The extracted text travels with each
    Firestore document, so no local files are needed."""
    try:
        sources = db.list_ready_sources()
    except Exception as e:
        log.warning("could not load sources from Firestore: %s", e)
        return
    for src in sources:
        try:
            rag.register_source(
                src["id"], src.get("name", ""), src.get("type", "pdf"),
                src.get("text", ""), src.get("insurer", ""),
            )
        except Exception as e:
            log.warning("failed to cache source %s: %s", src.get("name"), e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    threading.Thread(target=_load_existing_sources, daemon=True).start()
    if settings.seed_dir:
        threading.Thread(
            target=seed_from_dir, args=(settings.seed_dir,), daemon=True
        ).start()
    yield


app = FastAPI(title="Sera API", version="0.1.0", lifespan=lifespan)

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
