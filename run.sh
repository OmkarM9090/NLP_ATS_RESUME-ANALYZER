#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ATS Resume Matcher — start backend (FastAPI :8000) + frontend (Next.js :3000)
#
# Usage:
#   ./run.sh            # install deps on first run, then start both servers
#   ./run.sh --backend  # start only the API server
#   ./run.sh --frontend # start only the Next.js server
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

PY=python3
[ -x "$BACKEND/.venv/bin/python" ] && PY="$BACKEND/.venv/bin/python"

start_backend() {
  cd "$BACKEND"
  if [ ! -d .venv ]; then
    echo "[backend] creating virtualenv..."
    python3 -m venv .venv
    ./.venv/bin/pip install --upgrade pip >/dev/null
  fi
  if ! ./.venv/bin/python -c "import fastapi" 2>/dev/null; then
    echo "[backend] installing dependencies (skips torch/sentence-transformers when"
    echo "          download.pytorch.org is unreachable — the TF-IDF/LSA fallback kicks in)."
    if ! ./.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu 2>/dev/null; then
      echo "[backend] torch unavailable — continuing without it (degraded semantic mode)."
      grep -vE '^(sentence-transformers|torch)' requirements.txt > /tmp/requirements-no-torch.txt
      ./.venv/bin/pip install -r /tmp/requirements-no-torch.txt
    else
      ./.venv/bin/pip install -r requirements.txt
    fi
  fi
  # Optional accuracy boost — never fatal when offline.
  ./.venv/bin/python -m spacy download en_core_web_sm 2>/dev/null || true
  echo "[backend] serving on http://0.0.0.0:8000 (docs: /docs)"
  exec ./.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
}

start_frontend() {
  cd "$FRONTEND"
  if [ ! -d node_modules ]; then
    echo "[frontend] installing dependencies..."
    npm install --no-audit --no-fund
  fi
  echo "[frontend] serving on http://0.0.0.0:3000"
  exec npm run dev -- -H 0.0.0.0 -p 3000
}

case "${1:-all}" in
  --backend)  start_backend ;;
  --frontend) start_frontend ;;
  all)
    trap 'kill 0' EXIT INT TERM
    start_backend  >"$ROOT/backend.log"  2>&1 &
    start_frontend >"$ROOT/frontend.log" 2>&1 &
    echo "Starting backend (:8000) and frontend (:3000)..."
    echo "Logs: backend.log / frontend.log — Ctrl+C stops both."
    wait
    ;;
  *) echo "Unknown option: $1 (use --backend, --frontend or no argument)"; exit 1 ;;
esac
