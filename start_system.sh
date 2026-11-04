#!/usr/bin/env bash
# ========================================================
#       Group Z AI Traffic Control System Startup
# ========================================================

set -e

# Resolve repository root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo "       Starting Group Z AI Traffic Control System"
echo "========================================================"
echo ""

# 1. Pull latest commits from GitHub
echo "[1/4] Pulling latest version from GitHub..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"
    git pull origin "$CURRENT_BRANCH" || echo "[WARNING] Git pull failed or offline. Continuing with local version..."
else
    echo "[WARNING] Not inside a Git repository. Skipping git pull..."
fi
echo ""

# 2. Setup Python environment and install backend libraries
echo "[2/4] Checking backend Python environment..."
PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    echo "[ERROR] Python 3 was not found in PATH! Please install Python 3.10+."
    exit 1
fi

# Detect or create virtual environment
if [ ! -d "backend/.venv" ]; then
    echo "Creating virtual environment in backend/.venv..."
    "$PYTHON_CMD" -m venv backend/.venv
fi

# Determine python executable inside venv (Linux/macOS vs Git Bash on Windows)
if [ -f "backend/.venv/bin/python" ]; then
    VENV_PYTHON="$SCRIPT_DIR/backend/.venv/bin/python"
elif [ -f "backend/.venv/Scripts/python.exe" ]; then
    VENV_PYTHON="$SCRIPT_DIR/backend/.venv/Scripts/python.exe"
else
    echo "Recreating virtual environment..."
    "$PYTHON_CMD" -m venv backend/.venv
    if [ -f "backend/.venv/bin/python" ]; then
        VENV_PYTHON="$SCRIPT_DIR/backend/.venv/bin/python"
    else
        VENV_PYTHON="$SCRIPT_DIR/backend/.venv/Scripts/python.exe"
    fi
fi

echo "Installing/updating backend Python dependencies..."
"$VENV_PYTHON" -m pip install --upgrade pip --quiet
"$VENV_PYTHON" -m pip install -r backend/requirements.txt
echo "[OK] Backend dependencies ready."
echo ""

# 3. Check and install frontend dependencies
echo "[3/4] Checking and installing frontend npm dependencies..."
if ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] Node.js / npm was not found in PATH! Please install Node.js."
    exit 1
fi

(cd frontend && npm install)
echo "[OK] Frontend dependencies ready."
echo ""

# 4. Start backend and frontend services
echo "[4/4] Starting backend and frontend services..."

cleanup() {
    echo ""
    echo "Shutting down Group Z AI Traffic Control System..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start backend in background
(cd backend && "$VENV_PYTHON" main.py) &
BACKEND_PID=$!

# Start frontend in background
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "========================================================"
echo " System running!"
echo " - Backend API:         http://localhost:8000 (Docs: /docs)"
echo " - Frontend Dashboard:  http://localhost:3000"
echo "========================================================"
echo "Press Ctrl+C to stop all services."
echo ""

# Wait for background processes
wait
