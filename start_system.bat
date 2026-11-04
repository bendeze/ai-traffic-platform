@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ========================================================
echo        Starting Group Z AI Traffic Control System
echo ========================================================
echo.

REM 1. Pull latest commits from GitHub
echo [1/4] Checking and pulling latest updates from GitHub...
git rev-parse --is-inside-work-tree >nul 2>&1
if %errorlevel% equ 0 (
    git pull
    if errorlevel 1 (
        echo [WARNING] Git pull failed or offline. Continuing with local version...
    ) else (
        echo [OK] Repository synchronized with latest commit.
    )
) else (
    echo [WARNING] Not inside a Git repository. Skipping git pull...
)
echo.

REM 2. Package Manager Selection: uv vs pip
echo [2/4] Setting up Python backend environment...
set "USE_UV=0"
where uv >nul 2>&1
if %errorlevel% equ 0 (
    echo Found 'uv' package manager on your system ^(recommended for fast dependency resolution^).
    set /p "PM_CHOICE=Select package manager [1: uv (default), 2: pip]: "
    if "!PM_CHOICE!"=="" set "PM_CHOICE=1"
    if "!PM_CHOICE!"=="1" set "USE_UV=1"
) else (
    echo 'uv' is not detected in PATH.
    set /p "INSTALL_UV=Would you like to install 'uv' for 10x faster installation? [y/N]: "
    if /i "!INSTALL_UV!"=="y" (
        echo Installing uv via official installer...
        powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
        set "PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.cargo\bin;!PATH!"
        where uv >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] uv installed successfully.
            set "USE_UV=1"
        ) else (
            echo [WARNING] Could not find uv in PATH. Continuing with pip...
        )
    )
)

if "!USE_UV!"=="1" (
    echo Using 'uv' for backend environment and dependencies...
    if not exist "backend\.venv" (
        echo Creating virtual environment using uv...
        uv venv backend\.venv
    )
    echo Installing/updating dependencies with uv...
    uv pip install -r backend\requirements.txt --python backend\.venv
    set "BACKEND_START_CMD=uv --directory "%~dp0backend" run python main.py"
    echo [OK] Backend dependencies ready via uv.
) else (
    echo Using standard 'pip' for backend environment and dependencies...
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
    echo Installing/updating backend Python dependencies with pip...
    backend\.venv\Scripts\python.exe -m pip install --upgrade pip --quiet
    backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install backend dependencies.
        pause
        exit /b 1
    )
    set "BACKEND_START_CMD=cd /d "%~dp0backend" && .venv\Scripts\python.exe main.py"
    echo [OK] Backend dependencies ready via pip.
)
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
start "Group Z - Backend (Port 8000)" cmd /k "!BACKEND_START_CMD!"
start "Group Z - Frontend Dashboard (Port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================================
echo  System running!
echo  - Backend API:         http://localhost:8000 (Docs: /docs)
echo  - Frontend Dashboard:  http://localhost:3000
echo ========================================================
echo.
pause
