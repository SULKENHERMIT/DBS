-- ============================================================================
-- 11_create_dashboard_user.sql
-- Dedicated least-privilege read-only role for the custom Web Dashboard API.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dashboard_reader') THEN
        CREATE ROLE dashboard_reader WITH LOGIN PASSWORD 'DashboardViewer_2026_Secure!';
    ELSE
        ALTER ROLE dashboard_reader WITH PASSWORD 'DashboardViewer_2026_Secure!';
    END IF;
END
$$;

-- 1. Grant connection permission
GRANT CONNECT ON DATABASE postgres TO dashboard_reader;

-- 2. Grant schema usage permissions
GRANT USAGE ON SCHEMA public TO dashboard_reader;
GRANT USAGE ON SCHEMA timescaledb_information TO dashboard_reader;
GRANT USAGE ON SCHEMA _timescaledb_internal TO dashboard_reader;

-- 3. Grant SELECT on all relational tables, hypertables, and views
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dashboard_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA timescaledb_information TO dashboard_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA _timescaledb_internal TO dashboard_reader;

-- 4. Grant EXECUTE on analytical functions (e.g., get_portfolio_valuation, compression stats)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO dashboard_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA _timescaledb_internal TO dashboard_reader;

-- 5. Ensure future tables created in public schema also grant SELECT
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO dashboard_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO dashboard_reader;

SELECT rolname, rolsuper, rolinherit, rolcanlogin 
FROM pg_roles 
WHERE rolname IN ('dashboard_reader', 'grafana_reader');
