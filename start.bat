
@echo off
title AI Data Scientist Launcher

set "PROJECT=D:\Projects\ai-data-scientist"
set "BACKEND=%PROJECT%\backend"
set "FRONTEND=%PROJECT%\frontend"

echo ==========================================
echo       AI DATA SCIENTIST PLATFORM
echo ==========================================

echo.
echo Checking frontend dependencies...

if not exist "%FRONTEND%\node_modules\vite" (
    echo Installing frontend dependencies...
    cd /d "%FRONTEND%"
    call npm install

    if errorlevel 1 (
        echo ERROR: Frontend dependency installation failed.
        pause
        exit /b 1
    )
)

echo.
echo Starting Python backend...

start "AI Data Scientist - Backend" cmd /k "cd /d "%BACKEND%" && venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

echo Starting React frontend...

start "AI Data Scientist - Frontend" cmd /k "cd /d "%FRONTEND%" && npm run dev -- --host 127.0.0.1"

timeout /t 3 /nobreak >nul

start "" http://127.0.0.1:5173

echo.
echo AI DATA SCIENTIST STARTED
echo Backend: http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:5173

pause
