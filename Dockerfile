# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

# System dependencies for Tesseract, Poppler, and OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-ara \
    poppler-utils \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Python dependencies ─────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── Application code ────────────────────────────────────────────────────────
COPY . .

# ─── Create storage directories ──────────────────────────────────────────────
RUN mkdir -p data/uploads data/faiss_index logs

# ─── Environment defaults ────────────────────────────────────────────────────
ENV TESSERACT_PATH=/usr/bin/tesseract
ENV APP_HOST=0.0.0.0
ENV APP_PORT=8000

# ─── Expose ports ────────────────────────────────────────────────────────────
# FastAPI
EXPOSE 8000
# Streamlit
EXPOSE 8501

# ─── Startup script ──────────────────────────────────────────────────────────
# Run both FastAPI and Streamlit using a shell entrypoint
COPY <<'EOF' /app/start.sh
#!/bin/bash
set -e
echo "Starting FastAPI backend on port 8000…"
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
echo "Starting Streamlit frontend on port 8501…"
streamlit run frontend/streamlit_app.py --server.port 8501 --server.address 0.0.0.0 --server.headless true
EOF
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
