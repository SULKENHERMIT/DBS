@echo off
title Live Crypto and Stock Analysis Platform - Dashboard Launcher
echo =======================================================================
echo   Live Crypto and Stock Analysis Platform - TimescaleDB Dashboard
echo =======================================================================
echo.
echo [1/3] Verifying TimescaleDB container 'timescale-crypto'...
docker ps --filter "name=timescale-crypto" --format "{{.Names}}: {{.Status}}"

echo.
echo [2/3] Launching Python FastAPI Backend on http://localhost:8001 ...
start "TimescaleDB Analytics - Backend API" cmd /k "cd /d %~dp0backend && python run.py"

echo.
echo [3/3] Launching React Vite Frontend on http://localhost:5173 ...
start "TimescaleDB Analytics - Frontend Web" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo =======================================================================
echo   All services launched!
echo.
echo   * Web Dashboard:  http://localhost:5173
echo   * Backend API:    http://localhost:8001
echo   * API Docs:       http://localhost:8001/docs
echo   * TimescaleDB:    localhost:5433 (postgres)
echo =======================================================================
echo.
timeout /t 3 >nul
start http://localhost:5173
