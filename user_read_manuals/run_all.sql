-- ============================================================================
-- LIVE STOCK & CRYPTOCURRENCY PORTFOLIO MANAGEMENT SYSTEM
-- Unified Database Initialization Script (run_all.sql)
-- Target Database: PostgreSQL 14+
-- ============================================================================
-- Execution Order:
--   1. Extension Initialization (uuid-ossp)
--   2. DDL Table Creation (strict foreign key dependency order)
--   3. Relational & Query Optimization Indexes
--   4. PL/pgSQL Stored Functions, Procedures & Triggers
--   5. Consistent Sample Seed Data (matching UUIDs across all foreign keys)
--   6. Verification SELECT Queries & Example Procedure Invocations (commented)
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSION INITIALIZATION
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 2: DDL TABLE DEFINITIONS
-- ============================================================================

-- 1. Currency Rates (Base currency exchange lookup)
CREATE TABLE IF NOT EXISTS currency_rates (
    currency_code VARCHAR(10) PRIMARY KEY,
    rate_to_usd NUMERIC(18, 6) NOT NULL CHECK (rate_to_usd > 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Users (Core user accounts & preferences)
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    base_currency VARCHAR(10) DEFAULT 'USD' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_users_currency FOREIGN KEY (base_currency) REFERENCES currency_rates (currency_code) ON UPDATE CASCADE
);

-- 3. Exchanges (Trading venues & stock markets)
CREATE TABLE IF NOT EXISTS exchanges (
    exchange_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    url VARCHAR(500)
);

-- 4. Assets (Global catalog for stocks & crypto)
CREATE TABLE IF NOT EXISTS assets (
    asset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('crypto', 'stock')),
    network VARCHAR(100),
    contract_address VARCHAR(255),
    ticker_exchange VARCHAR(50),
    sector VARCHAR(100),
    exchange_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_assets_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges (exchange_id) ON DELETE SET NULL
);

-- 5. Ticker Stats (1:1 24h market summary metrics)
CREATE TABLE IF NOT EXISTS ticker_stats (
    asset_id UUID PRIMARY KEY,
    price_per_unit NUMERIC(18, 6) NOT NULL DEFAULT 0.0,
    volume_24h NUMERIC(24, 2) DEFAULT 0.0,
    high_24h NUMERIC(18, 6) DEFAULT 0.0,
    low_24h NUMERIC(18, 6) DEFAULT 0.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_ticker_stats_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE CASCADE
);

-- 6. Portfolios (User portfolio containers)
CREATE TABLE IF NOT EXISTS portfolios (
    portfolio_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_portfolios_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- 7. Holdings (Active asset positions in portfolios)
CREATE TABLE IF NOT EXISTS holdings (
    holding_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL,
    asset_id UUID,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('crypto', 'stock')),
    quantity NUMERIC(24, 8) NOT NULL CHECK (quantity > 0),
    average_buy_price NUMERIC(18, 6) NOT NULL CHECK (average_buy_price >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_holdings_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (portfolio_id) ON DELETE CASCADE,
    CONSTRAINT fk_holdings_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL,
    CONSTRAINT uq_portfolio_symbol UNIQUE (portfolio_id, symbol)
);

-- 8. Transactions (Immutable trade execution ledger)
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    portfolio_id UUID NOT NULL,
    asset_id UUID,
    symbol VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT')),
    quantity NUMERIC(24, 8) NOT NULL CHECK (quantity > 0),
    price_at_transaction NUMERIC(18, 6) NOT NULL CHECK (price_at_transaction >= 0),
    network_hash VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_tx_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (portfolio_id) ON DELETE CASCADE,
    CONSTRAINT fk_tx_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL
);

-- 9. Portfolio Performance (Periodic historical equity snapshots)
CREATE TABLE IF NOT EXISTS portfolio_performance (
    performance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL,
    total_value NUMERIC(18, 2) NOT NULL,
    total_profit_loss NUMERIC(18, 2) NOT NULL,
    total_profit_loss_pct NUMERIC(8, 4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_perf_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (portfolio_id) ON DELETE CASCADE
);

-- 10. Watchlists (User watchlist headers)
CREATE TABLE IF NOT EXISTS watchlists (
    watchlist_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    creation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_watchlists_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- 11. Watchlist Items (Tracked symbol entries)
CREATE TABLE IF NOT EXISTS watchlist_items (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watchlist_id UUID NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    asset_id UUID,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_wl_items_watchlist FOREIGN KEY (watchlist_id) REFERENCES watchlists (watchlist_id) ON DELETE CASCADE,
    CONSTRAINT fk_wl_items_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL,
    CONSTRAINT uq_watchlist_symbol UNIQUE (watchlist_id, symbol)
);

-- 12. Alerts (Price threshold rule definitions)
CREATE TABLE IF NOT EXISTS alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    asset_id UUID,
    threshold NUMERIC(18, 6) NOT NULL CHECK (threshold > 0),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('ABOVE', 'BELOW')),
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_alerts_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_alerts_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL
);

-- 13. Notifications (Dispatched alert notification logs)
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL,
    user_id UUID NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'PUSH', 'IN_APP')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_notif_alert FOREIGN KEY (alert_id) REFERENCES alerts (alert_id) ON DELETE CASCADE,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- 14. Price History (Granular historical price timeseries)
CREATE TABLE IF NOT EXISTS price_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    asset_id UUID,
    price NUMERIC(18, 6) NOT NULL,
    volume NUMERIC(24, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_history_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL
);

-- 15. News Articles (Market news headlines & metadata)
CREATE TABLE IF NOT EXISTS news_articles (
    article_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    headline VARCHAR(500) NOT NULL,
    source VARCHAR(100) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 16. News Article Assets (Junction linking news to assets)
CREATE TABLE IF NOT EXISTS news_article_assets (
    article_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    PRIMARY KEY (article_id, asset_id),
    CONSTRAINT fk_naa_article FOREIGN KEY (article_id) REFERENCES news_articles (article_id) ON DELETE CASCADE,
    CONSTRAINT fk_naa_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE CASCADE
);

-- 17. Price Cache (High-speed cached external quotes with TTL)
CREATE TABLE IF NOT EXISTS price_cache (
    cache_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('crypto', 'stock')),
    price_usd NUMERIC(18, 6) NOT NULL,
    high_24h NUMERIC(18, 6),
    low_24h NUMERIC(18, 6),
    volume_24h NUMERIC(24, 2),
    change_24h NUMERIC(8, 4),
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expire_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,
    CONSTRAINT uq_cache_symbol_type UNIQUE (symbol, asset_type)
);

-- 18. Audit Logs (Security and user action audit trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    action VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- ============================================================================
-- SECTION 3: PERFORMANCE & RELATIONAL INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets (symbol);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets (type);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios (user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_portfolio_id ON holdings (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings (symbol);
CREATE INDEX IF NOT EXISTS idx_tx_portfolio_time ON transactions (portfolio_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_perf_portfolio_time ON portfolio_performance (portfolio_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist ON watchlist_items (watchlist_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_enabled ON alerts (user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_price_history_sym_time ON price_history (symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_cache_expire ON price_cache (expire_at);
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_logs (user_id, timestamp DESC);

-- ============================================================================
-- SECTION 4: PL/PGSQL PROCEDURES, FUNCTIONS & TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Auto-Update Holdings Modification Timestamp Trigger Function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_holdings_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_holdings_timestamp ON holdings;
CREATE TRIGGER trg_update_holdings_timestamp
BEFORE UPDATE ON holdings
FOR EACH ROW
EXECUTE FUNCTION update_holdings_timestamp();

-- ----------------------------------------------------------------------------
-- 2. Auto-Insert Transaction Activity into Audit Logs Trigger Function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_transaction_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO audit_logs (
        log_id,
        user_id,
        action,
        timestamp
    ) VALUES (
        uuid_generate_v4(),
        NEW.user_id,
        'TRADE_EXECUTION: ' || NEW.type || ' ' || NEW.quantity::TEXT || ' ' || NEW.symbol || ' @ ' || NEW.price_at_transaction::TEXT || ' (Portfolio: ' || NEW.portfolio_id::TEXT || ')',
        COALESCE(NEW.timestamp, CURRENT_TIMESTAMP)
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_transaction_activity ON transactions;
CREATE TRIGGER trg_log_transaction_activity
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION log_transaction_activity();

-- ----------------------------------------------------------------------------
-- 3. Weighted-Average-Cost Holding Position Upsert
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_holding(
    p_portfolio_id UUID,
    p_asset_id UUID,
    p_symbol VARCHAR,
    p_name VARCHAR,
    p_type VARCHAR,
    p_quantity NUMERIC,
    p_buy_price NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_holding_id UUID;
BEGIN
    -- Input validation
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Holding quantity must be strictly positive (received: %)', p_quantity;
    END IF;

    IF p_buy_price < 0 THEN
        RAISE EXCEPTION 'Holding purchase price cannot be negative (received: %)', p_buy_price;
    END IF;

    IF p_type NOT IN ('crypto', 'stock') THEN
        RAISE EXCEPTION 'Invalid asset type "%". Must be "crypto" or "stock"', p_type;
    END IF;

    -- Perform atomic upsert with weighted average cost recalculation
    INSERT INTO holdings (
        portfolio_id,
        asset_id,
        symbol,
        name,
        type,
        quantity,
        average_buy_price,
        updated_at
    ) VALUES (
        p_portfolio_id,
        p_asset_id,
        p_symbol,
        p_name,
        p_type,
        p_quantity,
        p_buy_price,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (portfolio_id, symbol)
    DO UPDATE SET
        quantity = holdings.quantity + EXCLUDED.quantity,
        average_buy_price = ((holdings.quantity * holdings.average_buy_price) + (EXCLUDED.quantity * EXCLUDED.average_buy_price)) / (holdings.quantity + EXCLUDED.quantity),
        updated_at = CURRENT_TIMESTAMP
    RETURNING holding_id INTO v_holding_id;

    RETURN v_holding_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to upsert holding for symbol % in portfolio %: %', p_symbol, p_portfolio_id, SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Atomic Transaction Recording and Holdings Synchronization
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_transaction_and_update_holding(
    p_user_id UUID,
    p_portfolio_id UUID,
    p_asset_id UUID,
    p_symbol VARCHAR,
    p_type VARCHAR,
    p_quantity NUMERIC,
    p_price NUMERIC,
    p_network_hash VARCHAR DEFAULT NULL,
    p_asset_name VARCHAR DEFAULT NULL,
    p_asset_type VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_tx_id UUID;
    v_current_qty NUMERIC(24, 8);
    v_current_avg NUMERIC(18, 6);
    v_resolved_name VARCHAR(150);
    v_resolved_type VARCHAR(20);
BEGIN
    -- Validate inputs
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Transaction quantity must be strictly greater than 0';
    END IF;

    IF p_price < 0 THEN
        RAISE EXCEPTION 'Transaction price cannot be negative';
    END IF;

    IF p_type NOT IN ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT') THEN
        RAISE EXCEPTION 'Invalid transaction type: %. Expected BUY, SELL, TRANSFER_IN, or TRANSFER_OUT', p_type;
    END IF;

    -- Resolve asset metadata if not supplied
    IF p_asset_name IS NULL OR p_asset_type IS NULL THEN
        SELECT name, type INTO v_resolved_name, v_resolved_type
        FROM assets
        WHERE symbol = p_symbol
        LIMIT 1;

        v_resolved_name := COALESCE(v_resolved_name, p_symbol);
        v_resolved_type := COALESCE(v_resolved_type, 'crypto');
    ELSE
        v_resolved_name := p_asset_name;
        v_resolved_type := p_asset_type;
    END IF;

    -- Handle Holdings Adjustment
    IF p_type IN ('BUY', 'TRANSFER_IN') THEN
        INSERT INTO holdings (
            portfolio_id, asset_id, symbol, name, type, quantity, average_buy_price, updated_at
        ) VALUES (
            p_portfolio_id, p_asset_id, p_symbol, v_resolved_name, v_resolved_type, p_quantity, p_price, CURRENT_TIMESTAMP
        )
        ON CONFLICT (portfolio_id, symbol)
        DO UPDATE SET
            quantity = holdings.quantity + EXCLUDED.quantity,
            average_buy_price = CASE 
                WHEN (holdings.quantity + EXCLUDED.quantity) > 0 
                THEN ((holdings.quantity * holdings.average_buy_price) + (EXCLUDED.quantity * EXCLUDED.average_buy_price)) / (holdings.quantity + EXCLUDED.quantity)
                ELSE holdings.average_buy_price
            END,
            updated_at = CURRENT_TIMESTAMP;

    ELSIF p_type IN ('SELL', 'TRANSFER_OUT') THEN
        SELECT quantity, average_buy_price INTO v_current_qty, v_current_avg
        FROM holdings
        WHERE portfolio_id = p_portfolio_id AND symbol = p_symbol;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cannot execute %: No existing position for symbol % in portfolio %', p_type, p_symbol, p_portfolio_id;
        END IF;

        IF v_current_qty < p_quantity THEN
            RAISE EXCEPTION 'Insufficient position balance: attempted to % % %, but current holding is %', p_type, p_quantity, p_symbol, v_current_qty;
        ELSIF v_current_qty = p_quantity THEN
            DELETE FROM holdings
            WHERE portfolio_id = p_portfolio_id AND symbol = p_symbol;
        ELSE
            UPDATE holdings
            SET quantity = quantity - p_quantity,
                updated_at = CURRENT_TIMESTAMP
            WHERE portfolio_id = p_portfolio_id AND symbol = p_symbol;
        END IF;
    END IF;

    -- Insert Transaction Ledger Record
    INSERT INTO transactions (
        user_id,
        portfolio_id,
        asset_id,
        symbol,
        type,
        quantity,
        price_at_transaction,
        network_hash,
        timestamp
    ) VALUES (
        p_user_id,
        p_portfolio_id,
        p_asset_id,
        p_symbol,
        p_type,
        p_quantity,
        p_price,
        p_network_hash,
        CURRENT_TIMESTAMP
    )
    RETURNING transaction_id INTO v_tx_id;

    RETURN v_tx_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Transaction execution failed and state rolled back: %', SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Active Price Alerts Evaluation and Notification Dispatch
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_price_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_alert RECORD;
    v_triggered_count INTEGER := 0;
    v_current_price NUMERIC(18, 6);
BEGIN
    FOR v_alert IN
        SELECT 
            al.alert_id,
            al.user_id,
            al.symbol,
            al.threshold,
            al.direction,
            COALESCE(pc.price_usd, ts.price_per_unit) AS current_price
        FROM alerts al
        LEFT JOIN assets a ON al.symbol = a.symbol
        LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
        LEFT JOIN price_cache pc ON al.symbol = pc.symbol
        WHERE al.enabled = TRUE
    LOOP
        BEGIN
            v_current_price := v_alert.current_price;

            IF v_current_price IS NOT NULL THEN
                IF (v_alert.direction = 'ABOVE' AND v_current_price >= v_alert.threshold) OR
                   (v_alert.direction = 'BELOW' AND v_current_price <= v_alert.threshold) THEN

                    -- Insert Notification Record
                    INSERT INTO notifications (
                        alert_id,
                        user_id,
                        channel,
                        status,
                        sent_at
                    ) VALUES (
                        v_alert.alert_id,
                        v_alert.user_id,
                        'IN_APP',
                        'PENDING',
                        CURRENT_TIMESTAMP
                    );

                    -- Deactivate Alert & Record Trigger Timestamp
                    UPDATE alerts
                    SET enabled = FALSE,
                        triggered_at = CURRENT_TIMESTAMP
                    WHERE alert_id = v_alert.alert_id;

                    v_triggered_count := v_triggered_count + 1;
                END IF;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Isolate failure to single alert so entire evaluation loop completes
                RAISE WARNING 'Error evaluating alert ID % for symbol %: %', v_alert.alert_id, v_alert.symbol, SQLERRM;
        END;
    END LOOP;

    RETURN v_triggered_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Live Portfolio Valuation and Unrealized Profit/Loss Table
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_portfolio_valuation(p_portfolio_id UUID)
RETURNS TABLE (
    holding_id UUID,
    symbol VARCHAR(20),
    name VARCHAR(150),
    type VARCHAR(20),
    quantity NUMERIC(24, 8),
    average_buy_price NUMERIC(18, 6),
    current_price NUMERIC(18, 6),
    cost_basis NUMERIC(24, 6),
    market_value NUMERIC(24, 6),
    unrealized_pnl NUMERIC(24, 6),
    unrealized_pnl_pct NUMERIC(18, 4),
    portfolio_base_currency VARCHAR(10),
    currency_rate_to_usd NUMERIC(18, 6),
    market_value_base_currency NUMERIC(24, 6)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.holding_id,
        h.symbol,
        h.name,
        h.type,
        h.quantity,
        h.average_buy_price,
        COALESCE(pc.price_usd, ts.price_per_unit, 0.0) AS current_price,
        (h.quantity * h.average_buy_price) AS cost_basis,
        (h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0.0)) AS market_value,
        ((h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0.0)) - (h.quantity * h.average_buy_price)) AS unrealized_pnl,
        CASE 
            WHEN h.average_buy_price > 0 
            THEN (((COALESCE(pc.price_usd, ts.price_per_unit, 0.0) - h.average_buy_price) / h.average_buy_price) * 100.0)
            ELSE 0.0 
        END AS unrealized_pnl_pct,
        u.base_currency AS portfolio_base_currency,
        COALESCE(cr.rate_to_usd, 1.0) AS currency_rate_to_usd,
        ((h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0.0)) / COALESCE(cr.rate_to_usd, 1.0)) AS market_value_base_currency
    FROM holdings h
    JOIN portfolios p ON h.portfolio_id = p.portfolio_id
    JOIN users u ON p.user_id = u.user_id
    LEFT JOIN currency_rates cr ON u.base_currency = cr.currency_code
    LEFT JOIN assets a ON h.symbol = a.symbol
    LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
    LEFT JOIN price_cache pc ON h.symbol = pc.symbol AND pc.expire_at > CURRENT_TIMESTAMP
    WHERE h.portfolio_id = p_portfolio_id
    ORDER BY market_value DESC;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Automated Portfolio Valuation Performance Snapshot Recorder
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_portfolio_snapshot(p_portfolio_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_value NUMERIC(18, 2) := 0.0;
    v_total_cost NUMERIC(18, 2) := 0.0;
    v_total_pnl NUMERIC(18, 2) := 0.0;
    v_total_pnl_pct NUMERIC(8, 4) := 0.0;
    v_perf_id UUID;
BEGIN
    -- Calculate current portfolio valuation aggregates
    SELECT 
        COALESCE(SUM(h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0.0)), 0.0)::NUMERIC(18, 2),
        COALESCE(SUM(h.quantity * h.average_buy_price), 0.0)::NUMERIC(18, 2)
    INTO v_total_value, v_total_cost
    FROM holdings h
    LEFT JOIN assets a ON h.symbol = a.symbol
    LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
    LEFT JOIN price_cache pc ON h.symbol = pc.symbol AND pc.expire_at > CURRENT_TIMESTAMP
    WHERE h.portfolio_id = p_portfolio_id;

    v_total_pnl := v_total_value - v_total_cost;

    IF v_total_cost > 0 THEN
        v_total_pnl_pct := ((v_total_pnl / v_total_cost) * 100.0)::NUMERIC(8, 4);
    ELSE
        v_total_pnl_pct := 0.0;
    END IF;

    -- Record snapshot in portfolio_performance
    INSERT INTO portfolio_performance (
        portfolio_id,
        total_value,
        total_profit_loss,
        total_profit_loss_pct,
        timestamp
    ) VALUES (
        p_portfolio_id,
        v_total_value,
        v_total_pnl,
        v_total_pnl_pct,
        CURRENT_TIMESTAMP
    )
    RETURNING performance_id INTO v_perf_id;

    RETURN v_perf_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to record performance snapshot for portfolio %: %', p_portfolio_id, SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Expire and Purge Stale Price Cache Routine
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_price_cache()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
BEGIN
    DELETE FROM price_cache
    WHERE expire_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Price cache expiration routine failed: %', SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Recalculate 24-Hour Ticker Statistics from Price History
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_ticker_stats(p_asset_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_symbol VARCHAR(20);
    v_latest_price NUMERIC(18, 6);
    v_high_24h NUMERIC(18, 6);
    v_low_24h NUMERIC(18, 6);
    v_volume_24h NUMERIC(24, 2);
BEGIN
    -- Find symbol for given asset
    SELECT symbol INTO v_symbol
    FROM assets
    WHERE asset_id = p_asset_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset with ID % does not exist', p_asset_id;
    END IF;

    -- Extract aggregates from price_history over the last 24 hours
    SELECT 
        MAX(ph.price),
        MIN(ph.price),
        COALESCE(SUM(ph.volume), 0.0)
    INTO v_high_24h, v_low_24h, v_volume_24h
    FROM price_history ph
    WHERE (ph.asset_id = p_asset_id OR ph.symbol = v_symbol)
      AND ph.timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours';

    -- Fetch the most recent recorded price
    SELECT price INTO v_latest_price
    FROM price_history ph
    WHERE (ph.asset_id = p_asset_id OR ph.symbol = v_symbol)
    ORDER BY ph.timestamp DESC
    LIMIT 1;

    -- If no recent history exists, maintain current or fallback
    IF v_latest_price IS NOT NULL THEN
        INSERT INTO ticker_stats (
            asset_id,
            price_per_unit,
            volume_24h,
            high_24h,
            low_24h,
            updated_at
        ) VALUES (
            p_asset_id,
            v_latest_price,
            COALESCE(v_volume_24h, 0.0),
            COALESCE(v_high_24h, v_latest_price),
            COALESCE(v_low_24h, v_latest_price),
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (asset_id)
        DO UPDATE SET
            price_per_unit = EXCLUDED.price_per_unit,
            volume_24h = EXCLUDED.volume_24h,
            high_24h = EXCLUDED.high_24h,
            low_24h = EXCLUDED.low_24h,
            updated_at = CURRENT_TIMESTAMP;
            
        RETURN TRUE;
    END IF;

    RETURN FALSE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to refresh ticker stats for asset %: %', p_asset_id, SQLERRM;
END;
$$;

-- ============================================================================
-- SECTION 5: REALISTIC SAMPLE SEED DATA
-- (Using consistent matching UUIDs across all foreign keys)
-- ============================================================================

-- 1. Currency Rates
INSERT INTO currency_rates (currency_code, rate_to_usd, updated_at) VALUES
('USD', 1.000000, CURRENT_TIMESTAMP),
('EUR', 1.085000, CURRENT_TIMESTAMP),
('GBP', 1.270000, CURRENT_TIMESTAMP),
('JPY', 0.006500, CURRENT_TIMESTAMP),
('CAD', 0.740000, CURRENT_TIMESTAMP),
('AUD', 0.655000, CURRENT_TIMESTAMP)
ON CONFLICT (currency_code) DO UPDATE SET rate_to_usd = EXCLUDED.rate_to_usd, updated_at = CURRENT_TIMESTAMP;

-- 2. Users
INSERT INTO users (user_id, email, password_hash, base_currency, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'investor@example.com', '$2b$12$e8uqQ8pA9eZ4c5x6y7z8uOuI7h8j9k0l1m2n3o4p5q6r7s8t9u0v', 'USD', CURRENT_TIMESTAMP - INTERVAL '60 days'),
('00000000-0000-0000-0000-000000000002', 'crypto_trader@example.com', '$2b$12$e8uqQ8pA9eZ4c5x6y7z8uOuI7h8j9k0l1m2n3o4p5q6r7s8t9u0v', 'EUR', CURRENT_TIMESTAMP - INTERVAL '45 days'),
('00000000-0000-0000-0000-000000000003', 'tech_analyst@example.com', '$2b$12$e8uqQ8pA9eZ4c5x6y7z8uOuI7h8j9k0l1m2n3o4p5q6r7s8t9u0v', 'GBP', CURRENT_TIMESTAMP - INTERVAL '30 days')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Exchanges
INSERT INTO exchanges (exchange_id, name, country, url) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Binance Global', 'Malta', 'https://www.binance.com'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Coinbase Exchange', 'United States', 'https://www.coinbase.com'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'NASDAQ Stock Market', 'United States', 'https://www.nasdaq.com'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'New York Stock Exchange (NYSE)', 'United States', 'https://www.nyse.com')
ON CONFLICT (exchange_id) DO NOTHING;

-- 4. Assets Catalog (Crypto & Stocks)
INSERT INTO assets (asset_id, symbol, name, type, network, contract_address, ticker_exchange, sector, exchange_id, created_at) VALUES
('22222222-2222-2222-2222-222222222222', 'BTC', 'Bitcoin', 'crypto', 'Bitcoin Core', NULL, NULL, NULL, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_TIMESTAMP - INTERVAL '100 days'),
('22222222-2222-2222-2222-222222222223', 'ETH', 'Ethereum', 'crypto', 'Ethereum Mainnet', '0x0000000000000000000000000000000000000000', NULL, NULL, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_TIMESTAMP - INTERVAL '100 days'),
('22222222-2222-2222-2222-222222222224', 'SOL', 'Solana', 'crypto', 'Solana Mainnet-Beta', NULL, NULL, NULL, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_TIMESTAMP - INTERVAL '90 days'),
('22222222-2222-2222-2222-222222222225', 'AAPL', 'Apple Inc.', 'stock', NULL, NULL, 'NASDAQ', 'Consumer Electronics', 'cccccccc-cccc-cccc-cccc-cccccccccccc', CURRENT_TIMESTAMP - INTERVAL '100 days'),
('22222222-2222-2222-2222-222222222226', 'NVDA', 'NVIDIA Corporation', 'stock', NULL, NULL, 'NASDAQ', 'Semiconductors & AI', 'cccccccc-cccc-cccc-cccc-cccccccccccc', CURRENT_TIMESTAMP - INTERVAL '90 days'),
('22222222-2222-2222-2222-222222222227', 'TSLA', 'Tesla Inc.', 'stock', NULL, NULL, 'NASDAQ', 'Automotive & Clean Tech', 'cccccccc-cccc-cccc-cccc-cccccccccccc', CURRENT_TIMESTAMP - INTERVAL '80 days')
ON CONFLICT (asset_id) DO NOTHING;

-- 5. Ticker Stats (1:1 with catalog assets)
INSERT INTO ticker_stats (asset_id, price_per_unit, volume_24h, high_24h, low_24h, updated_at) VALUES
('22222222-2222-2222-2222-222222222222', 64500.000000, 28500000000.00, 65200.000000, 63800.000000, CURRENT_TIMESTAMP),
('22222222-2222-2222-2222-222222222223', 3450.000000, 16200000000.00, 3510.000000, 3390.000000, CURRENT_TIMESTAMP),
('22222222-2222-2222-2222-222222222224', 148.500000, 4200000000.00, 154.000000, 142.000000, CURRENT_TIMESTAMP),
('22222222-2222-2222-2222-222222222225', 228.750000, 5800000000.00, 231.500000, 226.100000, CURRENT_TIMESTAMP),
('22222222-2222-2222-2222-222222222226', 124.500000, 9400000000.00, 127.800000, 121.200000, CURRENT_TIMESTAMP),
('22222222-2222-2222-2222-222222222227', 242.100000, 6100000000.00, 248.000000, 238.500000, CURRENT_TIMESTAMP)
ON CONFLICT (asset_id) DO UPDATE SET
    price_per_unit = EXCLUDED.price_per_unit,
    volume_24h = EXCLUDED.volume_24h,
    high_24h = EXCLUDED.high_24h,
    low_24h = EXCLUDED.low_24h,
    updated_at = CURRENT_TIMESTAMP;

-- 6. Portfolios
INSERT INTO portfolios (portfolio_id, user_id, name, created_at) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Growth & Multi-Asset Fund', CURRENT_TIMESTAMP - INTERVAL '45 days'),
('11111111-1111-1111-1111-111111111112', '00000000-0000-0000-0000-000000000001', 'Long Term Cold Storage', CURRENT_TIMESTAMP - INTERVAL '30 days'),
('11111111-1111-1111-1111-111111111113', '00000000-0000-0000-0000-000000000002', 'High Beta Crypto Portfolio', CURRENT_TIMESTAMP - INTERVAL '25 days')
ON CONFLICT (portfolio_id) DO NOTHING;

-- 7. Holdings
INSERT INTO holdings (holding_id, portfolio_id, asset_id, symbol, name, type, quantity, average_buy_price, updated_at) VALUES
('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'BTC', 'Bitcoin', 'crypto', 1.25000000, 58200.000000, CURRENT_TIMESTAMP - INTERVAL '5 days'),
('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', 'ETH', 'Ethereum', 'crypto', 8.50000000, 3100.000000, CURRENT_TIMESTAMP - INTERVAL '4 days'),
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222225', 'AAPL', 'Apple Inc.', 'stock', 50.00000000, 210.000000, CURRENT_TIMESTAMP - INTERVAL '10 days'),
('33333333-3333-3333-3333-333333333334', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222226', 'NVDA', 'NVIDIA Corporation', 'stock', 80.00000000, 105.500000, CURRENT_TIMESTAMP - INTERVAL '8 days'),
('33333333-3333-3333-3333-333333333335', '11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222222222', 'BTC', 'Bitcoin', 'crypto', 2.00000000, 48000.000000, CURRENT_TIMESTAMP - INTERVAL '20 days')
ON CONFLICT (portfolio_id, symbol) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    average_buy_price = EXCLUDED.average_buy_price,
    updated_at = CURRENT_TIMESTAMP;

-- 8. Transactions
INSERT INTO transactions (transaction_id, user_id, portfolio_id, asset_id, symbol, type, quantity, price_at_transaction, network_hash, timestamp) VALUES
('55555555-5555-5555-5555-555555555551', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'BTC', 'BUY', 0.75000000, 56000.000000, '0x3a4f89b1c2d3e4f5', CURRENT_TIMESTAMP - INTERVAL '40 days'),
('55555555-5555-5555-5555-555555555552', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'BTC', 'BUY', 0.50000000, 61500.000000, '0x7b8c9d0e1f2a3b4c', CURRENT_TIMESTAMP - INTERVAL '15 days'),
('55555555-5555-5555-5555-555555555553', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222223', 'ETH', 'BUY', 8.50000000, 3100.000000, '0x9e8d7c6b5a4f3e2d', CURRENT_TIMESTAMP - INTERVAL '25 days'),
('55555555-5555-5555-5555-555555555554', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222225', 'AAPL', 'BUY', 50.00000000, 210.000000, NULL, CURRENT_TIMESTAMP - INTERVAL '30 days'),
('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222226', 'NVDA', 'BUY', 80.00000000, 105.500000, NULL, CURRENT_TIMESTAMP - INTERVAL '20 days')
ON CONFLICT (transaction_id) DO NOTHING;

-- 9. Portfolio Performance History
INSERT INTO portfolio_performance (performance_id, portfolio_id, total_value, total_profit_loss, total_profit_loss_pct, timestamp) VALUES
('66666666-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111', 121500.00, 14200.00, 13.2340, CURRENT_TIMESTAMP - INTERVAL '3 days'),
('66666666-6666-6666-6666-666666666662', '11111111-1111-1111-1111-111111111111', 126800.00, 19500.00, 18.1733, CURRENT_TIMESTAMP - INTERVAL '2 days'),
('66666666-6666-6666-6666-666666666663', '11111111-1111-1111-1111-111111111111', 129850.00, 22550.00, 21.0158, CURRENT_TIMESTAMP - INTERVAL '1 day'),
('66666666-6666-6666-6666-666666666664', '11111111-1111-1111-1111-111111111111', 131397.50, 24097.50, 22.4578, CURRENT_TIMESTAMP)
ON CONFLICT (performance_id) DO NOTHING;

-- 10. Watchlists
INSERT INTO watchlists (watchlist_id, user_id, name, creation_date) VALUES
('77777777-7777-7777-7777-777777777771', '00000000-0000-0000-0000-000000000001', 'Core Tech & Layer 1s', CURRENT_TIMESTAMP - INTERVAL '20 days'),
('77777777-7777-7777-7777-777777777772', '00000000-0000-0000-0000-000000000001', 'DeFi Breakouts', CURRENT_TIMESTAMP - INTERVAL '10 days')
ON CONFLICT (watchlist_id) DO NOTHING;

-- 11. Watchlist Items
INSERT INTO watchlist_items (item_id, watchlist_id, symbol, asset_id, added_at) VALUES
('88888888-8888-8888-8888-888888888881', '77777777-7777-7777-7777-777777777771', 'BTC', '22222222-2222-2222-2222-222222222222', CURRENT_TIMESTAMP - INTERVAL '20 days'),
('88888888-8888-8888-8888-888888888882', '77777777-7777-7777-7777-777777777771', 'ETH', '22222222-2222-2222-2222-222222222223', CURRENT_TIMESTAMP - INTERVAL '20 days'),
('88888888-8888-8888-8888-888888888883', '77777777-7777-7777-7777-777777777771', 'NVDA', '22222222-2222-2222-2222-222222222226', CURRENT_TIMESTAMP - INTERVAL '15 days'),
('88888888-8888-8888-8888-888888888884', '77777777-7777-7777-7777-777777777771', 'SOL', '22222222-2222-2222-2222-222222222224', CURRENT_TIMESTAMP - INTERVAL '10 days')
ON CONFLICT (watchlist_id, symbol) DO NOTHING;

-- 12. Alerts
INSERT INTO alerts (alert_id, user_id, symbol, asset_id, threshold, direction, enabled, triggered_at, created_at) VALUES
('44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000001', 'BTC', '22222222-2222-2222-2222-222222222222', 64000.000000, 'ABOVE', TRUE, NULL, CURRENT_TIMESTAMP - INTERVAL '5 days'),
('44444444-4444-4444-4444-444444444442', '00000000-0000-0000-0000-000000000001', 'ETH', '22222222-2222-2222-2222-222222222223', 3200.000000, 'BELOW', TRUE, NULL, CURRENT_TIMESTAMP - INTERVAL '3 days'),
('44444444-4444-4444-4444-444444444443', '00000000-0000-0000-0000-000000000001', 'NVDA', '22222222-2222-2222-2222-222222222226', 120.000000, 'ABOVE', TRUE, NULL, CURRENT_TIMESTAMP - INTERVAL '2 days'),
('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'TSLA', '22222222-2222-2222-2222-222222222227', 200.000000, 'BELOW', FALSE, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '15 days')
ON CONFLICT (alert_id) DO NOTHING;

-- 13. Notifications
INSERT INTO notifications (notification_id, alert_id, user_id, channel, status, sent_at) VALUES
('99999999-9999-9999-9999-999999999991', '44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'EMAIL', 'SENT', CURRENT_TIMESTAMP - INTERVAL '10 days'),
('99999999-9999-9999-9999-999999999992', '44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'IN_APP', 'SENT', CURRENT_TIMESTAMP - INTERVAL '10 days')
ON CONFLICT (notification_id) DO NOTHING;

-- 14. Price History (Multiple timeseries data points over last 24h)
INSERT INTO price_history (history_id, symbol, asset_id, price, volume, timestamp) VALUES
(uuid_generate_v4(), 'BTC', '22222222-2222-2222-2222-222222222222', 63850.000000, 450000000.00, CURRENT_TIMESTAMP - INTERVAL '20 hours'),
(uuid_generate_v4(), 'BTC', '22222222-2222-2222-2222-222222222222', 64200.000000, 620000000.00, CURRENT_TIMESTAMP - INTERVAL '12 hours'),
(uuid_generate_v4(), 'BTC', '22222222-2222-2222-2222-222222222222', 65200.000000, 980000000.00, CURRENT_TIMESTAMP - INTERVAL '6 hours'),
(uuid_generate_v4(), 'BTC', '22222222-2222-2222-2222-222222222222', 64500.000000, 510000000.00, CURRENT_TIMESTAMP - INTERVAL '10 minutes'),

(uuid_generate_v4(), 'ETH', '22222222-2222-2222-2222-222222222223', 3390.000000, 210000000.00, CURRENT_TIMESTAMP - INTERVAL '18 hours'),
(uuid_generate_v4(), 'ETH', '22222222-2222-2222-2222-222222222223', 3480.000000, 320000000.00, CURRENT_TIMESTAMP - INTERVAL '8 hours'),
(uuid_generate_v4(), 'ETH', '22222222-2222-2222-2222-222222222223', 3450.000000, 190000000.00, CURRENT_TIMESTAMP - INTERVAL '15 minutes'),

(uuid_generate_v4(), 'NVDA', '22222222-2222-2222-2222-222222222226', 121.200000, 850000000.00, CURRENT_TIMESTAMP - INTERVAL '16 hours'),
(uuid_generate_v4(), 'NVDA', '22222222-2222-2222-2222-222222222226', 127.800000, 1200000000.00, CURRENT_TIMESTAMP - INTERVAL '4 hours'),
(uuid_generate_v4(), 'NVDA', '22222222-2222-2222-2222-222222222226', 124.500000, 720000000.00, CURRENT_TIMESTAMP - INTERVAL '30 minutes');

-- 15. News Articles
INSERT INTO news_articles (article_id, headline, source, url, published_at) VALUES
('abababab-abab-abab-abab-abababababab', 'Bitcoin Surpasses Key Resistance as Institutional Inflows Surge', 'Bloomberg Crypto', 'https://bloomberg.com/news/crypto/btc-inflow', CURRENT_TIMESTAMP - INTERVAL '6 hours'),
('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', 'NVIDIA Unveils Next-Generation Blackwell Ultra AI Superchips', 'TechCrunch', 'https://techcrunch.com/2026/09/nvda-blackwell', CURRENT_TIMESTAMP - INTERVAL '12 hours'),
('efefefef-efef-efef-efef-efefefefefef', 'Apple Expands On-Device AI Intelligence Architecture to Global Markets', 'Reuters Tech', 'https://reuters.com/tech/apple-ai-expansion', CURRENT_TIMESTAMP - INTERVAL '18 hours')
ON CONFLICT (article_id) DO NOTHING;

-- 16. News Article Asset Junction
INSERT INTO news_article_assets (article_id, asset_id) VALUES
('abababab-abab-abab-abab-abababababab', '22222222-2222-2222-2222-222222222222'),
('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', '22222222-2222-2222-2222-222222222226'),
('efefefef-efef-efef-efef-efefefefefef', '22222222-2222-2222-2222-222222222225')
ON CONFLICT (article_id, asset_id) DO NOTHING;

-- 17. Price Cache (Active and expired quote entries)
INSERT INTO price_cache (cache_id, symbol, asset_type, price_usd, high_24h, low_24h, volume_24h, change_24h, fetched_at, expire_at, metadata) VALUES
(uuid_generate_v4(), 'BTC', 'crypto', 64500.000000, 65200.000000, 63800.000000, 28500000000.00, 1.8500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', '{"provider": "coingecko", "cache_tier": "l1"}'::jsonb),
(uuid_generate_v4(), 'ETH', 'crypto', 3450.000000, 3510.000000, 3390.000000, 16200000000.00, 2.1000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', '{"provider": "coingecko", "cache_tier": "l1"}'::jsonb),
(uuid_generate_v4(), 'NVDA', 'stock', 124.500000, 127.800000, 121.200000, 9400000000.00, 3.2500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', '{"provider": "finnhub", "cache_tier": "l1"}'::jsonb),
(uuid_generate_v4(), 'AAPL', 'stock', 228.750000, 231.500000, 226.100000, 5800000000.00, 0.9500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', '{"provider": "finnhub", "cache_tier": "l1"}'::jsonb),
(uuid_generate_v4(), 'DOGE', 'crypto', 0.125000, 0.132000, 0.121000, 1200000000.00, -1.2000, CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '30 minutes', '{"provider": "coingecko", "stale": true}'::jsonb)
ON CONFLICT (symbol, asset_type) DO UPDATE SET
    price_usd = EXCLUDED.price_usd,
    high_24h = EXCLUDED.high_24h,
    low_24h = EXCLUDED.low_24h,
    volume_24h = EXCLUDED.volume_24h,
    change_24h = EXCLUDED.change_24h,
    fetched_at = EXCLUDED.fetched_at,
    expire_at = EXCLUDED.expire_at,
    metadata = EXCLUDED.metadata;

-- 18. Audit Logs (Initial security event seeds)
INSERT INTO audit_logs (log_id, user_id, action, timestamp) VALUES
(uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'USER_SIGNUP', CURRENT_TIMESTAMP - INTERVAL '60 days'),
(uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'PORTFOLIO_CREATED: Growth & Multi-Asset Fund', CURRENT_TIMESTAMP - INTERVAL '45 days'),
(uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'USER_LOGIN: IP 192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '1 day');

-- ============================================================================
-- SECTION 6: VERIFICATION SELECT QUERIES
-- ============================================================================

-- Verification 1: Verify Table Counts and Integrity
SELECT 'users' AS table_name, count(*) AS row_count FROM users
UNION ALL SELECT 'portfolios', count(*) FROM portfolios
UNION ALL SELECT 'holdings', count(*) FROM holdings
UNION ALL SELECT 'assets', count(*) FROM assets
UNION ALL SELECT 'ticker_stats', count(*) FROM ticker_stats
UNION ALL SELECT 'transactions', count(*) FROM transactions
UNION ALL SELECT 'alerts', count(*) FROM alerts
UNION ALL SELECT 'price_cache', count(*) FROM price_cache;

-- Verification 2: Run Live Portfolio Valuation Function
SELECT * FROM get_portfolio_valuation('11111111-1111-1111-1111-111111111111');

-- ============================================================================
-- SECTION 7: PL/PGSQL FUNCTION CALL EXAMPLES (COMMENTED OUT FOR TESTING)
-- ============================================================================

/*
-- Example 1: Test Holding Position Upsert Procedure
SELECT upsert_holding(
    '11111111-1111-1111-1111-111111111111'::UUID,
    '22222222-2222-2222-2222-222222222224'::UUID,
    'SOL',
    'Solana',
    'crypto',
    10.00000000,
    145.000000
);

-- Example 2: Test Atomic Trade Execution Function (BUY Order)
SELECT record_transaction_and_update_holding(
    '00000000-0000-0000-0000-000000000001'::UUID,
    '11111111-1111-1111-1111-111111111111'::UUID,
    '22222222-2222-2222-2222-222222222223'::UUID,
    'ETH',
    'BUY',
    2.00000000,
    3400.000000,
    '0xabc123def456',
    'Ethereum',
    'crypto'
);

-- Example 3: Test Price Alert Evaluation and Notification Dispatch
SELECT check_price_alerts();

-- Example 4: Test Portfolio Performance Snapshot Recorder
SELECT record_portfolio_snapshot('11111111-1111-1111-1111-111111111111'::UUID);

-- Example 5: Test Stale Price Cache Housekeeping Routine
SELECT expire_price_cache();

-- Example 6: Test 24-Hour Ticker Stats Recalculation Function
SELECT refresh_ticker_stats('22222222-2222-2222-2222-222222222222'::UUID);

-- Example 7: Verify Automatic Trigger on Transaction Insert (Audit Log)
SELECT * FROM audit_logs WHERE user_id = '00000000-0000-0000-0000-000000000001' ORDER BY timestamp DESC LIMIT 5;
*/
