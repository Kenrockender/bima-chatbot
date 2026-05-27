import os
import uuid
import shutil
import asyncio
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from . import rag
from .auth import require_admin
from .config import settings
from .db import get_conn
from .schemas import SourceOut, UrlIngestRequest


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/verify")
def verify(_=Depends(require_admin)):
    return {"ok": True}


@router.get("/sources", response_model=List[SourceOut])
def list_sources(_=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM sources ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def _set_status(source_id: str, status: str, error: str | None = None, chunk_count: int | None = None):
    with get_conn() as conn:
        if chunk_count is not None:
            conn.execute(
                "UPDATE sources SET status=?, error=?, chunk_count=?, updated_at=datetime('now') WHERE id=?",
                (status, error, chunk_count, source_id),
            )
        else:
            conn.execute(
                "UPDATE sources SET status=?, error=?, updated_at=datetime('now') WHERE id=?",
                (status, error, source_id),
            )


def _process_pdf(source_id: str, source_name: str, file_path: str):
    try:
        n = rag.ingest_pdf(source_id, source_name, file_path)
        _set_status(source_id, "ready", None, n)
    except Exception as e:
        _set_status(source_id, "failed", str(e), 0)


def _process_url(source_id: str, source_name: str, url: str):
    try:
        n = rag.ingest_url(source_id, source_name, url)
        _set_status(source_id, "ready", None, n)
    except Exception as e:
        _set_status(source_id, "failed", str(e), 0)


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
        safe_name = file.filename
        dest = os.path.join(settings.upload_dir, f"{source_id}_{safe_name}")
        with open(dest, "wb") as out:
            shutil.copyfileobj(file.file, out)
        with get_conn() as conn:
            conn.execute(
                "INSERT INTO sources (id, name, type, origin, status) VALUES (?, ?, 'pdf', ?, 'processing')",
                (source_id, safe_name, dest),
            )
        background.add_task(_process_pdf, source_id, safe_name, dest)
        created.append({"id": source_id, "name": safe_name})
    return {"created": created}


@router.post("/sources/url")
def add_url(
    req: UrlIngestRequest,
    background: BackgroundTasks,
    _=Depends(require_admin),
):
    source_id = uuid.uuid4().hex
    name = req.name or str(req.url)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sources (id, name, type, origin, status) VALUES (?, ?, 'url', ?, 'processing')",
            (source_id, name, str(req.url)),
        )
    background.add_task(_process_url, source_id, name, str(req.url))
    return {"id": source_id, "name": name}


@router.delete("/sources/{source_id}")
def delete_source(source_id: str, _=Depends(require_admin)):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM sources WHERE id=?", (source_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Source not found")
        conn.execute("DELETE FROM sources WHERE id=?", (source_id,))
    try:
        rag.delete_source(source_id)
    except Exception:
        pass
    if row["type"] == "pdf":
        try:
            os.remove(row["origin"])
        except OSError:
            pass
    return {"ok": True}


@router.post("/sources/{source_id}/reindex")
def reindex(source_id: str, background: BackgroundTasks, _=Depends(require_admin)):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM sources WHERE id=?", (source_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Source not found")
    try:
        rag.delete_source(source_id)
    except Exception:
        pass
    _set_status(source_id, "processing", None, 0)
    if row["type"] == "pdf":
        background.add_task(_process_pdf, source_id, row["name"], row["origin"])
    else:
        background.add_task(_process_url, source_id, row["name"], row["origin"])
    return {"ok": True}
