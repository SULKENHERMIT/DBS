@echo off
title TimescaleDB Analytics - Web Dashboard (Port 5173)
echo ========================================================
echo  Starting TimescaleDB Market Analytics - Web Dashboard
echo  Listening on: http://localhost:5173
echo ========================================================
cd /d "%~dp0frontend"
npm run dev
pause
