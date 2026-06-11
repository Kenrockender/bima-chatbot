import os
import uuid
import shutil
from typing import List

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks

from . import rag, db, progress
from .auth import require_admin
from .config import settings
from .schemas import SourceOut, UrlIngestRequest


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/verify")
def verify(_=Depends(require_admin)):
    return {"ok": True}


@router.get("/overview")
def overview(_=Depends(require_admin)):
    """Aggregate team progress for the manager dashboard."""
    return progress.team_overview()


@router.get("/sources", response_model=List[SourceOut])
def list_sources(_=Depends(require_admin)):
    return db.list_sources()


def _process_pdf(source_id: str, source_name: str, temp_path: str, insurer: str = ""):
    """Extract text, persist it to Firestore, cache it, then drop the temp file."""
    try:
        text, pages = rag.extract_pdf_text(temp_path)
        if not text.strip():
            db.set_failed(source_id, "No extractable text in PDF")
            return
        db.set_ready(source_id, text, pages)
        rag.register_source(source_id, source_name, "pdf", text, insurer)
    except Exception as e:
        db.set_failed(source_id, str(e))
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


def _process_url(source_id: str, source_name: str, url: str):
    try:
        text = rag.extract_url_text(url)
        if not text.strip():
            db.set_failed(source_id, "No extractable text at URL")
            return
        db.set_ready(source_id, text, 1)
        rag.register_source(source_id, source_name, "url", text, rag.HOME_INSURER)
    except Exception as e:
        db.set_failed(source_id, str(e))


@router.post("/sources/pdf")
async def upload_pdfs(
    background: BackgroundTasks,
    files: List[UploadFile] = File(...),
    _=Depends(require_admin),
):
    os.makedirs(settings.upload_dir, exist_ok=True)
    created = []
    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            continue
        source_id = uuid.uuid4().hex
        name = file.filename
        temp_path = os.path.join(settings.upload_dir, f"{source_id}_{name}")
        with open(temp_path, "wb") as out:
            shutil.copyfileobj(file.file, out)
        # Admin uploads to the BCA Life onboarding tool are our own product docs.
        db.create_source(source_id, name, "pdf", name, rag.HOME_INSURER)
        background.add_task(_process_pdf, source_id, name, temp_path, rag.HOME_INSURER)
        created.append({"id": source_id, "name": name})
    return {"created": created}


@router.post("/sources/url")
def add_url(
    req: UrlIngestRequest,
    background: BackgroundTasks,
    _=Depends(require_admin),
):
    source_id = uuid.uuid4().hex
    name = req.name or str(req.url)
    db.create_source(source_id, name, "url", str(req.url), rag.HOME_INSURER)
    background.add_task(_process_url, source_id, name, str(req.url))
    return {"id": source_id, "name": name}


@router.delete("/sources/{source_id}")
def delete_source(source_id: str, _=Depends(require_admin)):
    if not db.delete_source(source_id):
        raise HTTPException(status_code=404, detail="Source not found")
    try:
        rag.delete_source(source_id)
    except Exception:
        pass
    return {"ok": True}


@router.post("/sources/{source_id}/reindex")
def reindex(source_id: str, background: BackgroundTasks, _=Depends(require_admin)):
    src = db.get_source(source_id)
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")
    if src["type"] == "url":
        # Re-fetch the URL so updated page content is picked up.
        db.set_processing(source_id)
        background.add_task(_process_url, source_id, src["name"], src["origin"])
    else:
        # PDF binaries aren't retained; reindex just reloads the stored text
        # into the in-memory prompt cache.
        try:
            rag.register_source(source_id, src["name"], "pdf", src.get("text", ""), src.get("insurer", ""))
        except Exception:
            pass
    return {"ok": True}
