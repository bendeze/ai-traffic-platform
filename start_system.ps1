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
Write-Host "[1/4] Checking and pulling latest updates from GitHub..." -ForegroundColor Yellow
try {
    git pull
    Write-Host "[OK] Repository synchronized with latest commit." -ForegroundColor Green
} catch {
    Write-Warning "Git pull failed or offline. Continuing with local version..."
}
Write-Host ""

# 2. Package Manager Selection: uv vs pip
Write-Host "[2/4] Setting up Python backend environment..." -ForegroundColor Yellow
$hasUv = [bool](Get-Command uv -ErrorAction SilentlyContinue)
$useUv = $false

if ($hasUv) {
    Write-Host "Found 'uv' on your system (recommended for ultra-fast dependency resolution)." -ForegroundColor Green
    $pmChoice = Read-Host "Select package manager [1: uv (default), 2: pip]"
    if ([string]::IsNullOrWhiteSpace($pmChoice) -or $pmChoice -eq "1") {
        $useUv = $true
    }
} else {
    Write-Host "'uv' was not detected in PATH." -ForegroundColor Gray
    $installUv = Read-Host "Would you like to install 'uv' for 10x faster installation? [y/N]"
    if ($installUv -match "^[Yy]$") {
        Write-Host "Installing uv via official installer..." -ForegroundColor Gray
        try {
            powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
            $env:Path = "$env:USERPROFILE\.local\bin;$env:USERPROFILE\.cargo\bin;$env:Path"
            if (Get-Command uv -ErrorAction SilentlyContinue) {
                Write-Host "[OK] uv installed successfully." -ForegroundColor Green
                $useUv = $true
            }
        } catch {
            Write-Warning "Failed to install uv. Falling back to standard pip."
        }
    }
}

if ($useUv) {
    Write-Host "Using 'uv' for backend environment and dependencies..." -ForegroundColor Green
    $venvPath = Join-Path $PSScriptRoot "backend\.venv"
    if (-not (Test-Path $venvPath)) {
        Write-Host "Creating virtual environment using uv..." -ForegroundColor Gray
        uv venv $venvPath
    }
    Write-Host "Installing/updating dependencies with uv..." -ForegroundColor Gray
    uv pip install -r (Join-Path $PSScriptRoot "backend\requirements.txt") --python $venvPath
    $backendCmd = "uv --directory '$PSScriptRoot\backend' run python main.py"
    Write-Host "[OK] Backend dependencies ready via uv." -ForegroundColor Green
} else {
    Write-Host "Using standard 'pip' for backend environment and dependencies..." -ForegroundColor Gray
    $venvPython = Join-Path $PSScriptRoot "backend\.venv\Scripts\python.exe"
    if (-not (Test-Path $venvPython)) {
        Write-Host "Creating virtual environment in backend\.venv..." -ForegroundColor Gray
        python -m venv (Join-Path $PSScriptRoot "backend\.venv")
    }
    Write-Host "Installing/updating backend Python dependencies with pip..." -ForegroundColor Gray
    & $venvPython -m pip install --upgrade pip --quiet
    & $venvPython -m pip install -r (Join-Path $PSScriptRoot "backend\requirements.txt")
    $backendCmd = "Set-Location '$PSScriptRoot\backend'; & '$venvPython' main.py"
    Write-Host "[OK] Backend dependencies ready via pip." -ForegroundColor Green
}
Write-Host ""

# 3. Check and install frontend dependencies
Write-Host "[3/4] Checking and installing frontend npm dependencies..." -ForegroundColor Yellow
Set-Location -Path (Join-Path $PSScriptRoot "frontend")
npm install --legacy-peer-deps
Set-Location -Path $PSScriptRoot
Write-Host "[OK] Frontend dependencies ready." -ForegroundColor Green
Write-Host ""

# 4. Start backend and frontend
Write-Host "[4/4] Starting backend and frontend services..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$backendCmd"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " System running!" -ForegroundColor Green
Write-Host " - Backend API:         http://localhost:8000 (Docs: /docs)" -ForegroundColor Green
Write-Host " - Frontend Dashboard:  http://localhost:3000" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
