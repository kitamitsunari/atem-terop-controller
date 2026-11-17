@echo off
cd /d "%~dp0"
title TEROP SYSTEM

echo.
echo ==================================================
echo   ATEM TEROP CONTROLLER - Startup
echo ==================================================
echo.
set /p ATEM_IP="  ATEM IP Address: "

if "%ATEM_IP%"=="" (
    echo   ERROR: No IP address entered.
    pause
    exit /b 1
)

echo.
echo   ATEM IP : %ATEM_IP%
echo   Starting Mini Web Server (8000) and ATEM Bridge (5050)...
echo.

rem 1. Local Mini Web Server (serves index.html)
start "TEROP WEB SERVER (8000)" cmd /k python -m http.server 8000 --bind 127.0.0.1

rem 2. ATEM Bridge Watcher
if exist "bin\terop_watcher.exe" (
    start "ATEM BRIDGE WATCHER (5050)" cmd /k bin\terop_watcher.exe --atem %ATEM_IP%
) else (
    start "ATEM BRIDGE WATCHER (5050)" cmd /k node terop_watcher.js --atem %ATEM_IP%
)

timeout /t 2 /nobreak > nul
start "" "http://localhost:8000/"

echo   OK! Browser opened: http://localhost:8000
echo.
pause