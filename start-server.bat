@echo off
title Barangay Management System Host Server

echo   Barangay Management System - Startup Launcher
echo.

:: 1. Verify Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js was not detected on this system.
    echo Please install Node.js LTS from https://nodejs.org/ to run the host server.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js runtime detected.
echo Preparing host server on http://localhost:3000...
echo.

:: 2. Launch default Windows browser to http://localhost:3000 in 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: 3. Run production server from server/dist/index.js if built, else fallback to development
cd /d "%~dp0"
set NODE_ENV=production

if not exist "server\dist\index.js" goto run_dev
if not exist "client\dist\index.html" goto run_dev

echo Starting production server...
node server\dist\index.js
goto finish

:run_dev
echo [INFO] Complete production build not found.
echo Starting development server...
call npm run dev

:finish
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Server terminated with an error code.
    pause
)

