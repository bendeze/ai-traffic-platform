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
echo "[1/4] Checking and pulling latest updates from GitHub..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"
    if git pull origin "$CURRENT_BRANCH"; then
        echo "[OK] Repository synchronized with latest commit."
    else
        echo "[WARNING] Git pull failed or offline. Continuing with local version..."
    fi
else
    echo "[WARNING] Not inside a Git repository. Skipping git pull..."
fi
echo ""

# 2. Select Python Package Manager (uv vs pip)
echo "[2/4] Setting up Python backend environment..."
HAS_UV=false
if command -v uv >/dev/null 2>&1; then
    HAS_UV=true
fi

USE_UV=false
if [ "$HAS_UV" = true ]; then
    echo "Found 'uv' on your system (recommended for ultra-fast dependency resolution)."
    read -r -p "Select package manager [1: uv (default), 2: pip]: " PM_CHOICE
    PM_CHOICE=${PM_CHOICE:-1}
    if [ "$PM_CHOICE" = "1" ]; then
        USE_UV=true
    fi
else
    echo "'uv' was not detected in PATH."
    read -r -p "Would you like to install 'uv' for 10x faster installation? [y/N]: " INSTALL_UV
    if [[ "$INSTALL_UV" =~ ^[Yy]$ ]]; then
        echo "Installing uv via official Astral installer..."
        if curl -LsSf https://astral.sh/uv/install.sh | sh; then
            export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
            if command -v uv >/dev/null 2>&1; then
                echo "[OK] uv installed successfully."
                USE_UV=true
            else
                echo "[WARNING] uv installed but not found in PATH for this subshell. Falling back to pip."
            fi
        else
            echo "[WARNING] Failed to install uv. Falling back to pip."
        fi
    fi
fi

# Setup Virtual Environment and Dependencies
if [ "$USE_UV" = true ]; then
    echo "Using 'uv' for backend environment and dependencies..."
    if [ ! -d "backend/.venv" ]; then
        echo "Creating virtual environment using uv..."
        uv venv backend/.venv
    fi
    echo "Installing/updating dependencies with uv..."
    uv pip install -r backend/requirements.txt --python backend/.venv
    BACKEND_CMD="uv --directory backend run python main.py"
    echo "[OK] Backend dependencies ready via uv."
else
    echo "Using standard 'pip' for backend environment and dependencies..."
    PYTHON_CMD=""
    if command -v python3 >/dev/null 2>&1; then
        PYTHON_CMD="python3"
    elif command -v python >/dev/null 2>&1; then
        PYTHON_CMD="python"
    else
        echo "[ERROR] Python 3 was not found in PATH! Please install Python 3.10+."
        exit 1
    fi

    if [ ! -d "backend/.venv" ]; then
        echo "Creating virtual environment using $PYTHON_CMD..."
        "$PYTHON_CMD" -m venv backend/.venv
    fi

    if [ -f "backend/.venv/bin/python" ]; then
        VENV_PYTHON="$SCRIPT_DIR/backend/.venv/bin/python"
    elif [ -f "backend/.venv/Scripts/python.exe" ]; then
        VENV_PYTHON="$SCRIPT_DIR/backend/.venv/Scripts/python.exe"
    else
        "$PYTHON_CMD" -m venv backend/.venv
        VENV_PYTHON="$SCRIPT_DIR/backend/.venv/bin/python"
    fi

    echo "Installing/updating dependencies with pip..."
    "$VENV_PYTHON" -m pip install --upgrade pip --quiet
    "$VENV_PYTHON" -m pip install -r backend/requirements.txt
    BACKEND_CMD="cd '$SCRIPT_DIR/backend' && '$VENV_PYTHON' main.py"
    echo "[OK] Backend dependencies ready via pip."
fi
echo ""

# 3. Frontend Dependencies
echo "[3/4] Checking and installing frontend npm dependencies..."
if ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] Node.js / npm was not found in PATH! Please install Node.js."
    exit 1
fi

(cd frontend && npm install)
echo "[OK] Frontend dependencies ready."
echo ""

# 4. Process Runner (Optional tmux split-terminal for Linux/macOS)
echo "[4/4] Preparing runtime session..."
RUN_TMUX=false

if [[ "$(uname -s)" =~ Linux|Darwin ]]; then
    read -r -p "Would you like to run the system in a single split-screen terminal (tmux)? [y/N]: " TMUX_CHOICE
    if [[ "$TMUX_CHOICE" =~ ^[Yy]$ ]]; then
        if ! command -v tmux >/dev/null 2>&1; then
            read -r -p "tmux is not installed. Would you like to install it now? [Y/n]: " INSTALL_TMUX
            INSTALL_TMUX=${INSTALL_TMUX:-Y}
            if [[ "$INSTALL_TMUX" =~ ^[Yy]$ ]]; then
                echo "Attempting to install tmux..."
                if command -v apt-get >/dev/null 2>&1; then
                    sudo apt-get update && sudo apt-get install -y tmux
                elif command -v dnf >/dev/null 2>&1; then
                    sudo dnf install -y tmux
                elif command -v yum >/dev/null 2>&1; then
                    sudo yum install -y tmux
                elif command -v pacman >/dev/null 2>&1; then
                    sudo pacman -S --noconfirm tmux
                elif command -v brew >/dev/null 2>&1; then
                    brew install tmux
                elif command -v apk >/dev/null 2>&1; then
                    sudo apk add tmux
                else
                    echo "[WARNING] Unknown package manager. Please install tmux manually."
                fi
            fi
        fi

        if command -v tmux >/dev/null 2>&1; then
            RUN_TMUX=true
        else
            echo "[WARNING] tmux is unavailable. Launching standard concurrent output..."
        fi
    fi
fi

if [ "$RUN_TMUX" = true ]; then
    SESSION_NAME="group-z-traffic"
    tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

    echo "Creating split tmux session '$SESSION_NAME'..."
    # Left pane: Backend
    tmux new-session -d -s "$SESSION_NAME" -n "TrafficSystem" "echo 'Starting Backend on Port 8000...'; $BACKEND_CMD"
    # Right pane: Frontend
    tmux split-window -h -t "$SESSION_NAME:0" "cd '$SCRIPT_DIR/frontend' && echo 'Starting Frontend on Port 3000...'; npm run dev"
    tmux select-layout -t "$SESSION_NAME:0" even-horizontal

    echo ""
    echo "========================================================"
    echo " System running in tmux split terminal!"
    echo " - Left Pane:   Backend (http://localhost:8000)"
    echo " - Right Pane:  Frontend (http://localhost:3000)"
    echo " (Switch panes: Ctrl+B then Left/Right arrow | Detach: Ctrl+B then d)"
    echo "========================================================"
    echo ""
    sleep 1
    tmux attach-session -t "$SESSION_NAME"
    exit 0
fi

# Fallback / Default: Standard Background Processes with Trap
echo "Starting backend and frontend services..."

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

# Start backend
if [ "$USE_UV" = true ]; then
    (cd "$SCRIPT_DIR/backend" && uv run python main.py) &
else
    (cd "$SCRIPT_DIR/backend" && "$VENV_PYTHON" main.py) &
fi
BACKEND_PID=$!

# Start frontend
(cd "$SCRIPT_DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "========================================================"
echo " System running!"
echo " - Backend API:         http://localhost:8000 (Docs: /docs)"
echo " - Frontend Dashboard:  http://localhost:3000"
echo "========================================================"
echo "Press Ctrl+C to stop all services."
echo ""

wait
