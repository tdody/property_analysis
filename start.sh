#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill stale processes on our ports
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

# Start backend
echo "Starting backend..."
cd "$ROOT_DIR/backend"
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend..."
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo "Backend running on http://localhost:8000"
echo "Frontend running on http://localhost:3000"
echo "Press Ctrl+C to stop both servers."

wait
