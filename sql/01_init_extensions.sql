-- ============================================================================
-- 01_init_extensions.sql
-- Live Crypto and Stock Analysis Platform - TimescaleDB Implementation
-- Source of Truth: DA-2 Report (Screenshots 1, run_all.sql)
-- ============================================================================

-- 1. UUID generation extension (Original DA-2 requirement)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TimescaleDB extension for time-series optimization and hypertables
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Verification of active extensions
SELECT extname, extversion 
FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'timescaledb');
