-- ============================================================================
-- 04_create_indexes.sql
-- Live Crypto and Stock Analysis Platform - Index Definitions
-- Source of Truth: DA-2 Report (Screenshots 7-8, run_all.sql)
-- Preserves all 14 original performance & relational indexes, plus TimescaleDB
-- chunk-optimized compound indexes.
-- ============================================================================

-- 1. Users: Fast lookup by email during authentication / login
CREATE INDEX IF NOT EXISTS idx_users_email 
    ON users (email);

-- 2. Assets: Quick symbol and asset-type filtering (crypto vs stock)
CREATE INDEX IF NOT EXISTS idx_assets_symbol 
    ON assets (symbol);

CREATE INDEX IF NOT EXISTS idx_assets_type 
    ON assets (type);

-- 3. Portfolios: Retrieve all portfolios belonging to a user
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id 
    ON portfolios (user_id);

-- 4. Holdings: Filter holdings by portfolio and asset symbol
CREATE INDEX IF NOT EXISTS idx_holdings_portfolio_id 
    ON holdings (portfolio_id);

CREATE INDEX IF NOT EXISTS idx_holdings_symbol 
    ON holdings (symbol);

-- 5. Transactions: Historical transaction ledger sorted by time descending
CREATE INDEX IF NOT EXISTS idx_tx_portfolio_time 
    ON transactions (portfolio_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_tx_user 
    ON transactions (user_id);

-- 6. Portfolio Performance: Fast equity curve chart generation by portfolio & time
CREATE INDEX IF NOT EXISTS idx_perf_portfolio_time 
    ON portfolio_performance (portfolio_id, timestamp DESC);

-- 7. Watchlist Items: Fast lookup of tracked symbols in a user's watchlist
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist 
    ON watchlist_items (watchlist_id);

-- 8. Alerts: Real-time alert polling engine index (filtering active user alerts)
CREATE INDEX IF NOT EXISTS idx_alerts_user_enabled 
    ON alerts (user_id, enabled);

-- 9. Price History (Hypertable Local Indexes):
-- Automatically propagated to all past and future chunks created by TimescaleDB
CREATE INDEX IF NOT EXISTS idx_price_history_sym_time 
    ON price_history (symbol, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_asset_time 
    ON price_history (asset_id, timestamp DESC);

-- 10. Price Cache: TTL background worker purge index for expired quotes
CREATE INDEX IF NOT EXISTS idx_price_cache_expire 
    ON price_cache (expire_at);

-- 11. Audit Logs: Security audit inspection sorted by timestamp descending
CREATE INDEX IF NOT EXISTS idx_audit_user_time 
    ON audit_logs (user_id, timestamp DESC);
