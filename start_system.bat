@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ========================================================
echo        Starting Group Z AI Traffic Control System
echo ========================================================
echo.

REM 1. Pull latest commits from GitHub
echo [1/4] Pulling latest version from GitHub...
git rev-parse --is-inside-work-tree >nul 2>&1
if %errorlevel% equ 0 (
    git pull
    if errorlevel 1 (
        echo [WARNING] Git pull failed or offline. Continuing with local version...
    ) else (
        echo [OK] Repository updated to latest commit.
    )
) else (
    echo [WARNING] Not inside a Git repository. Skipping git pull...
)
echo.

REM 2. Setup Python environment and install backend libraries
echo [2/4] Checking backend Python environment...
if not exist "backend\.venv\Scripts\python.exe" (
    echo Creating virtual environment in backend\.venv...
    where python >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Python is not found in PATH! Please install Python 3.10+.
        pause
        exit /b 1
    )
    python -m venv backend\.venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

echo Installing/updating backend Python dependencies...
backend\.venv\Scripts\python.exe -m pip install --upgrade pip --quiet
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies.
    pause
    exit /b 1
)
echo [OK] Backend dependencies ready.
echo.

REM 3. Install frontend dependencies
echo [3/4] Checking and installing frontend npm dependencies...
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js / npm is not found in PATH! Please install Node.js.
    pause
    exit /b 1
)

cd frontend
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed.
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Frontend dependencies ready.
echo.

REM 4. Launch backend and frontend
echo [4/4] Starting backend and frontend services...
start "Group Z - Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python.exe main.py"
start "Group Z - Frontend Dashboard (Port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================================
echo  System running!
echo  - Backend API:         http://localhost:8000 (Docs: /docs)
echo  - Frontend Dashboard:  http://localhost:3000
echo ========================================================
echo.
pause
