# syntax=docker/dockerfile:1
#
# ATS Resume Matcher — backend image.
#
# Two stages: a builder that compiles wheels, and a slim runtime that also
# carries the system libraries pdfplumber/pytesseract need plus the spaCy and
# sentence-transformers weights. When the weights cannot be downloaded (air-gapped
# build) the application still starts: it reports the fallback in
# `nlp_metadata.degraded_mode`, `GET /api/health` and `GET /api/models`.

ARG PYTHON_VERSION=3.11

# --------------------------------------------------------------------------- #
# Stage 1 — build dependencies
# --------------------------------------------------------------------------- #
FROM python:${PYTHON_VERSION}-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /build

# Build tooling for the handful of C-extension wheels (numpy, scipy, pdfminer).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip wheel --wheel-dir /wheels -r requirements.txt


# --------------------------------------------------------------------------- #
# Stage 2 — runtime
# --------------------------------------------------------------------------- #
FROM python:${PYTHON_VERSION}-slim AS runtime

ARG SPACY_MODEL=en_core_web_lg
ARG EMBEDDING_MODEL=all-MiniLM-L6-v2

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    # Keep model weights and the SQLite database on the mounted volume.
    HF_HOME=/var/lib/ats/models/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/var/lib/ats/models/huggingface \
    SPACY_DATA=/var/lib/ats/models/spacy \
    ATS_VAR_DIR=/var/lib/ats \
    ATS_ENABLE_EAGER_MODEL_LOAD=true \
    PORT=8000

# poppler-utils  -> pdf2image (rasterises scanned pages for OCR)
# tesseract-ocr  -> pytesseract OCR fallback
# libgomp1       -> numpy/scikit-learn OpenMP runtime
# curl           -> container healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        libgomp1 \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# ---- Model weights (best effort; failure only degrades accuracy) ---------- #
# `|| true` keeps air-gapped builds working: the app then runs on the offline
# heuristic spaCy pipeline and the TF-IDF/LSA encoder.
RUN python -m spacy download ${SPACY_MODEL} \
    || pip install https://github.com/explosion/spacy-models/releases/download/${SPACY_MODEL}-3.8.0/${SPACY_MODEL}-3.8.0-py3-none-any.whl \
    || echo "spaCy model unavailable — offline heuristic pipeline will be used"

RUN mkdir -p "${HF_HOME}" \
    && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${EMBEDDING_MODEL}')" \
    || echo "embedding weights unavailable — TF-IDF/LSA fallback will be used"

# ---- Application code ----------------------------------------------------- #
COPY . .

RUN mkdir -p /var/lib/ats/uploads /var/lib/ats/logs \
    && useradd --create-home --shell /usr/sbin/nologin --uid 10001 ats \
    && chown -R ats:ats /app /var/lib/ats

USER ats

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

# Warm the models before serving so the first request is not slow.
CMD ["sh", "-c", "python -c 'from services.cache_service import model_registry; model_registry.warm_up(background=False)' ; exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers ${UVICORN_WORKERS:-2} --proxy-headers --forwarded-allow-ips='*'"]
