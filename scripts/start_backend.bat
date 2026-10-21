@echo off
title TimescaleDB Analytics - Backend API (Port 8001)
echo ========================================================
echo  Starting TimescaleDB Analytics Platform - Backend API
echo  Listening on: http://localhost:8001
echo  API Documentation: http://localhost:8001/docs
echo ========================================================
cd /d "%~dp0backend"
python run.py
pause
