"""Pre-extract dataset PDFs into curated .txt files (one per PDF, same folder).

Why pre-extract?
- The seed dataset is small, stable and curated. Extracting once at build time
  (instead of on every cold start) is faster and removes pdfplumber from the
  hot path for seeding.
- Several competitor brochures extract poorly (doubled-glyph headers, image-only
  pages, two-column body merges). A committed .txt is git-diffable and can be
  hand-corrected so the LLM sees clean, comparable facts.
- The .txt is the single reviewable "source of truth" of exactly what the model
  reads — no hidden extraction variance.

Live admin uploads still go through pdfplumber (rag.extract_pdf_text); this
script only covers the curated seed corpus under dataset/<Insurer>/.

Run:  backend/.venv/Scripts/python.exe scripts/extract_dataset.py
"""
import os
import re
import sys

import pdfplumber

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET = os.path.join(ROOT, "dataset")

# Collapses "RRIINNGG" -> "RING" style doubled-glyph headers that some PDFs emit
# when two text render layers overlap. Only applied to a line when *most* of it
# looks doubled, so normal text (e.g. "sUUm") is left alone.
_DOUBLE_RUN = re.compile(r"(.)\1", re.DOTALL)


def _maybe_undouble(line: str) -> str:
    stripped = line.strip()
    if len(stripped) < 12:
        return line
    pairs = sum(1 for a, b in zip(stripped[::2], stripped[1::2]) if a == b)
    ratio = pairs / max(1, len(stripped) // 2)
    if ratio < 0.6:
        return line
    # Looks doubled: collapse each adjacent duplicate pair to one char.
    out, i = [], 0
    while i < len(stripped):
        out.append(stripped[i])
        if i + 1 < len(stripped) and stripped[i + 1] == stripped[i]:
            i += 2
        else:
            i += 1
    return "".join(out)


def clean(text: str) -> str:
    text = text.replace("�", "'")          # replacement char -> apostrophe
    text = text.replace(" ", " ")           # nbsp
    lines = [_maybe_undouble(ln) for ln in text.splitlines()]
    text = "\n".join(lines)
    text = re.sub(r"[ \t]{3,}", "  ", text)       # squash column padding
    text = re.sub(r"\n{3,}", "\n\n", text)        # squash blank runs
    return text.strip()


def extract(path: str) -> tuple[str, int]:
    parts, pages = [], 0
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            pages = i
            t = (page.extract_text() or "").strip()
            if t:
                parts.append(f"[hal. {i}]\n{t}")
    return "\n\n".join(parts), pages


def main() -> int:
    if not os.path.isdir(DATASET):
        print(f"no dataset dir at {DATASET}", file=sys.stderr)
        return 1
    total = 0
    for insurer in sorted(os.listdir(DATASET)):
        folder = os.path.join(DATASET, insurer)
        if not os.path.isdir(folder):
            continue
        for entry in sorted(os.listdir(folder)):
            if not entry.lower().endswith(".pdf"):
                continue
            pdf_path = os.path.join(folder, entry)
            txt_path = os.path.splitext(pdf_path)[0] + ".txt"
            raw, pages = extract(pdf_path)
            cleaned = clean(raw)
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(cleaned)
            flag = "  (LOW TEXT — likely image-only, review manually)" if len(cleaned) < 1000 else ""
            print(f"[{insurer}] {entry} -> {os.path.basename(txt_path)} "
                  f"({pages}p, {len(cleaned)} chars){flag}")
            total += 1
    print(f"done: {total} file(s) extracted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
