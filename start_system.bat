@echo off
echo ========================================================
echo        Starting Group Z AI Traffic Control System
echo ========================================================

echo Starting FastAPI Backend (Port 8000)...
start "Group Z - Backend" cmd /k "cd backend && .venv\Scripts\python.exe main.py"

echo Starting Vite Frontend Dashboard (Port 3000)...
start "Group Z - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo Backend will be available at: http://localhost:8000
echo Frontend Dashboard will be at: http://localhost:3000
echo ========================================================
pause

