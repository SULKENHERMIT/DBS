-- ============================================================================
-- run_all.sql
-- Live Crypto and Stock Analysis Platform - TimescaleDB Master Execution Script
-- Digital Assignment - 03 (Extending DA-02 with TimescaleDB)
-- Executes the complete schema, hypertables, indexes, PL/pgSQL triggers,
-- baseline & extended sample data, core queries, and verification suite.
-- ============================================================================

\echo '============================================================================'
\echo '1. INITIALIZING EXTENSIONS (UUID-OSSP & TIMESCALEDB)...'
\echo '============================================================================'
\i 01_init_extensions.sql

\echo '============================================================================'
\echo '2. CREATING ALL 18 RELATIONAL & TIMESERIES TABLES...'
\echo '============================================================================'
\i 02_create_tables.sql

\echo '============================================================================'
\echo '3. CONFIGURING HYPERTABLES, POLICIES & CONTINUOUS AGGREGATES...'
\echo '============================================================================'
\i 03_create_hypertables.sql

\echo '============================================================================'
\echo '4. CREATING PERFORMANCE & RELATIONAL INDEXES...'
\echo '============================================================================'
\i 04_create_indexes.sql

\echo '============================================================================'
\echo '5. CREATING PL/PGSQL TRIGGERS, PROCEDURES & ANALYTICAL FUNCTIONS...'
\echo '============================================================================'
\i 05_create_functions_and_triggers.sql

\echo '============================================================================'
\echo '6. SEEDING BASELINE SAMPLE DATASET (EXACT DA-2 VALUES)...'
\echo '============================================================================'
\i 06_seed_sample_data.sql

\echo '============================================================================'
\echo '7. SEEDING EXTENDED TIME-SERIES OBSERVATIONS (FOR TIMESCALE FEATURES)...'
\echo '============================================================================'
\i 07_seed_timeseries_extended.sql

\echo '============================================================================'
\echo '8. EXECUTING CORE OPERATIONS & TIMESCALEDB QUERIES...'
\echo '============================================================================'
\i 08_core_timeseries_queries.sql

\echo '============================================================================'
\echo '9. EXECUTING COMPREHENSIVE VERIFICATION & TEST SUITE...'
\echo '============================================================================'
\i 09_verification_tests.sql

\echo '============================================================================'
\echo 'MASTER RUN_ALL EXECUTION COMPLETE SUCCESSFULLY!'
\echo '============================================================================'
