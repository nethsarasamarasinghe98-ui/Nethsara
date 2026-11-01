@echo off
title RUHUNU PRODUCTS Billing Suite
echo ========================================================
echo  RUHUNU PRODUCTS - Billing & Invoicing Suite
echo  Starting local server with instant SQLite database sync...
echo ========================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Node.js detected. Launching Node server...
    start http://localhost:3000
    node server.js
    goto end
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Python detected. Launching Python server...
    start http://localhost:3000
    python server.py
    goto end
)

echo [ERROR] Neither Node.js nor Python was found in your PATH.
echo Please install Node.js (https://nodejs.org) or Python (https://python.org).
pause

:end
