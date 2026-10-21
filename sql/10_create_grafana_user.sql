-- ============================================================================
-- 10_create_grafana_user.sql
-- Creates a dedicated read-only role for Grafana with SELECT-only privileges.
-- Strictly adheres to the Principle of Least Privilege (no superuser access).
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'grafana_reader') THEN
        CREATE ROLE grafana_reader WITH LOGIN PASSWORD 'GrafanaViewer_2026_Secure!';
    ELSE
        ALTER ROLE grafana_reader WITH PASSWORD 'GrafanaViewer_2026_Secure!';
    END IF;
END
$$;

-- 1. Grant connection permission on the platform database
GRANT CONNECT ON DATABASE postgres TO grafana_reader;

-- 2. Grant schema usage permissions
GRANT USAGE ON SCHEMA public TO grafana_reader;
GRANT USAGE ON SCHEMA timescaledb_information TO grafana_reader;
GRANT USAGE ON SCHEMA _timescaledb_internal TO grafana_reader;

-- 3. Grant SELECT on all relational tables, hypertables, and views
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA timescaledb_information TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA _timescaledb_internal TO grafana_reader;

-- 4. Grant EXECUTE on analytical functions (e.g., get_portfolio_valuation, compression stats)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO grafana_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA _timescaledb_internal TO grafana_reader;

-- 5. Ensure future tables created in public schema also grant SELECT
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO grafana_reader;

-- Verification query
SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin 
FROM pg_roles 
WHERE rolname = 'grafana_reader';
