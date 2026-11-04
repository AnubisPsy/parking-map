@echo off
title Parking Map
set BASEDIR=%~dp0
if not exist "%BASEDIR%backend\node_modules" (cd /d "%BASEDIR%backend" && call npm ci)
if not exist "%BASEDIR%frontend\node_modules" (cd /d "%BASEDIR%frontend" && call npm ci)
start "Parking Map - Backend" /min cmd /c "cd /d "%BASEDIR%backend" && node index.js"
timeout /t 2 /nobreak >nul
start "Parking Map - Frontend" /min cmd /c "cd /d "%BASEDIR%frontend" && npm run dev"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5050"