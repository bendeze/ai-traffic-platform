# ========================================================
#       Group Z AI Traffic Control System Startup (PowerShell)
# ========================================================
$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Starting Group Z AI Traffic Control System" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Pull latest updates from GitHub
Write-Host "[1/4] Pulling latest version from GitHub..." -ForegroundColor Yellow
try {
    git pull
    Write-Host "[OK] Repository updated to latest commit." -ForegroundColor Green
} catch {
    Write-Warning "Git pull failed or offline. Continuing with local version..."
}
Write-Host ""

# 2. Check and install backend dependencies
Write-Host "[2/4] Checking backend Python environment..." -ForegroundColor Yellow
$venvPython = Join-Path $PSScriptRoot "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Creating virtual environment in backend\.venv..." -ForegroundColor Gray
    python -m venv (Join-Path $PSScriptRoot "backend\.venv")
}

Write-Host "Installing/updating backend Python dependencies..." -ForegroundColor Gray
& $venvPython -m pip install --upgrade pip --quiet
& $venvPython -m pip install -r (Join-Path $PSScriptRoot "backend\requirements.txt")
Write-Host "[OK] Backend dependencies ready." -ForegroundColor Green
Write-Host ""

# 3. Check and install frontend dependencies
Write-Host "[3/4] Checking and installing frontend npm dependencies..." -ForegroundColor Yellow
Set-Location -Path (Join-Path $PSScriptRoot "frontend")
npm install
Set-Location -Path $PSScriptRoot
Write-Host "[OK] Frontend dependencies ready." -ForegroundColor Green
Write-Host ""

# 4. Start backend and frontend
Write-Host "[4/4] Starting backend and frontend services..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\backend'; & '$venvPython' main.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " System running!" -ForegroundColor Green
Write-Host " - Backend API:         http://localhost:8000 (Docs: /docs)" -ForegroundColor Green
Write-Host " - Frontend Dashboard:  http://localhost:3000" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
