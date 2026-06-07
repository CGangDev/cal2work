@echo off
setlocal
title Cal2Work

cd /d "%~dp0"

:: ── Check Node.js ────────────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  Error: Node.js is not installed.
    echo  Download it from: https://nodejs.org/  (version 20 or later)
    echo.
    pause
    exit /b 1
)

:: ── Install dependencies (first run only) ────────────────────────────────────
if not exist "node_modules" (
    echo Installing dependencies (this only happens once^)...
    npm install
    echo.
)

:: ── Clear any leftover processes from a previous session ─────────────────────
echo Stopping any previous instances...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3001 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5174 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo Starting Cal2Work...
echo.

:: ── Start proxy server in the background ─────────────────────────────────────
start /b node server.mjs

:: Wait for proxy to be ready
timeout /t 2 /nobreak >nul

:: ── Open browser and start Vite ───────────────────────────────────────────────
echo =========================================
echo   Open this URL in your browser:
echo   http://localhost:5173
echo   Close this window to stop the app
echo =========================================
echo.

start "" "http://localhost:5173"
npm run dev

echo.
echo App has stopped.
pause
