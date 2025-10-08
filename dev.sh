#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating Python virtualenv in $VENV_DIR"
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --upgrade pip
  "$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Installing frontend dependencies"
  npm --prefix "$FRONTEND_DIR" install
fi

source "$VENV_DIR/bin/activate"

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACK_PID=$!

echo "Backend running on http://localhost:8000"

echo "Starting Vite dev server on http://localhost:5173"
npm --prefix "$FRONTEND_DIR" run dev -- --host &
FRONT_PID=$!

cleanup() {
  echo "Stopping services"
  kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
}

trap cleanup EXIT

wait
