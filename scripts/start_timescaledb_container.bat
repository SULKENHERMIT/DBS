@echo off
:: ============================================================================
:: start_timescaledb_container.bat
:: Starts official TimescaleDB container and runs platform schema
:: ============================================================================

title TimescaleDB Container Runner
color 0B

set DOCKER_BIN=docker
set HOST_PORT=5433

echo ============================================================================
echo   STARTING TIMESCALEDB DOCKER CONTAINER (PORT %HOST_PORT%)
echo ============================================================================
echo.

echo Pulling image and starting container...
%DOCKER_BIN% run -d --name timescale-crypto -p %HOST_PORT%:5432 -v "%~dp0..\sql:/sql" -e POSTGRES_PASSWORD=postgres timescale/timescaledb:latest-pg16
if %errorlevel% neq 0 (
    echo Container may already exist. Ensuring it is started...
    %DOCKER_BIN% start timescale-crypto
)

echo.
echo Waiting 5 seconds for database initialization...
timeout /t 5 /nobreak >nul

echo.
echo Active Containers:
%DOCKER_BIN% ps --filter "name=timescale-crypto"

echo.
echo Running master SQL script run_all.sql into TimescaleDB container...
%DOCKER_BIN% exec -i -w /sql timescale-crypto psql -U postgres -f /sql/run_all.sql

echo.
echo ============================================================================
echo   TIMESCALEDB CONTAINER IS UP AND PLATFORM DATABASE IS READY!
echo ============================================================================
echo Host: localhost
echo Port: %HOST_PORT% (configured on 5433 to avoid local PostgreSQL 18 conflict)
echo Database: postgres
echo User: postgres
echo Password: postgres
echo.
pause
