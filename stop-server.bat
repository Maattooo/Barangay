@echo off
setlocal enabledelayedexpansion
title Stop Barangay Management System Server

echo   Barangay Management System - Server Shutdown
echo.

set FOUND=0

:: Locate and terminate any process listening on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    set PID=%%a
    if "!PID!" neq "0" (
        echo Terminating server process on port 3000 [PID: !PID!]...
        taskkill /F /PID !PID! >nul 2>&1
        set FOUND=1
    )
)

:: Locate and terminate any dev process listening on port 5173 (Vite)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    set PID=%%a
    if "!PID!" neq "0" (
        echo Terminating Vite dev server on port 5173 [PID: !PID!]...
        taskkill /F /PID !PID! >nul 2>&1
        set FOUND=1
    )
)

echo.
if "!FOUND!"=="1" (
    echo [OK] Barangay Management System server stopped successfully.
) else (
    echo [INFO] No active Barangay server was found running on port 3000 or 5173.
)
ping 127.0.0.1 -n 3 >nul
exit /b 0
