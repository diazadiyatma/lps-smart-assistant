@echo off
title LPS Smart-Assistant Backend
echo ===================================================
echo   Starting LPS Smart-Assistant Backend Service
echo ===================================================
cd "%~dp0\backend"

if not exist venv (
    echo [INFO] Virtual environment not found. Creating venv...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create python virtual environment. Make sure python is installed and in your PATH.
        pause
        exit /b 1
    )
)

echo [INFO] Activating virtual environment...
call venv\Scripts\activate

echo [INFO] Installing/verifying dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

echo [INFO] Starting FastAPI backend with Uvicorn...
uvicorn app.main:app --reload --port 8000
