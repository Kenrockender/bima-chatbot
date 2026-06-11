FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Curated seed corpus (per-insurer .txt). Baked into the image so the backend
# auto-seeds Firestore on first start with no volume mount (Railway-friendly).
COPY seed ./seed

ENV PYTHONUNBUFFERED=1
ENV SEED_DIR=/app/seed
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
