@echo off
:: ============================================================================
:: open_psql_terminal.bat
:: Opens an interactive PostgreSQL/TimescaleDB terminal connected to port 5433
:: ============================================================================
title TimescaleDB Interactive Terminal (DA-3)
color 0A

echo ============================================================================
echo   CONNECTING TO TIMESCALEDB CONTAINER (PORT 5433)
echo ============================================================================
echo.
echo Database: postgres | User: postgres | Port: 5433
echo.
echo Useful Commands inside psql:
echo   \dt                           - List all 18 tables
echo   \dx                           - List active extensions (timescaledb, uuid-ossp)
echo   \i 08_core_timeseries_queries.sql - Run the 12 time-series analytical queries
echo   \i 09_verification_tests.sql      - Run the verification test suite
echo   \q                            - Quit psql
echo ============================================================================
echo.

docker exec -it -w /sql timescale-crypto psql -U postgres
