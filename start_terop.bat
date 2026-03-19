@echo off
title TEROP SYSTEM

echo.
echo ==================================================
echo   TEROP CONTROLLER - Startup
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
echo   Starting servers...
echo.

start "TEROP SERVER" cmd /k "bin\terop_server.exe"
timeout /t 3 /nobreak > nul
start "ATEM WATCHER" cmd /k "bin\terop_watcher.exe --atem "%ATEM_IP%"

echo.
echo   OK! Open browser: http://localhost:5050
echo.
pause 
