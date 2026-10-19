-- ============================================================================
-- LIVE STOCK & CRYPTOCURRENCY PORTFOLIO MANAGEMENT SYSTEM
-- Oracle SQL & PL/SQL Database Initialization Script (oracle_conversion.sql)
-- Target Database: Oracle Database 12c / 19c / 21c / 23c (SQL*Plus Compatible)
-- ============================================================================
-- CONVERSION CONVENTIONS APPLIED:
-- 1. Primary & Foreign Keys: Converted UUID to RAW(16) DEFAULT SYS_GUID().
-- 2. Character Data: Converted VARCHAR(n) to VARCHAR2(n).
-- 3. Booleans: Converted BOOLEAN to NUMBER(1) with CHECK (column_name IN (0, 1)).
-- 4. Semi-Structured Data: Converted JSONB to CLOB CHECK (column_name IS JSON) for broad compatibility.
-- 5. Timestamps: Converted DEFAULT CURRENT_TIMESTAMP to DEFAULT SYSTIMESTAMP.
-- 6. Numeric Types: Converted NUMERIC(p,s) to NUMBER(p,s).
-- 7. Upserts: Converted INSERT ... ON CONFLICT to ANSI/Oracle MERGE INTO ... USING dual.
-- 8. RETURNING Clauses: Converted to PL/SQL blocks utilizing RETURNING ... INTO with DBMS_OUTPUT.
-- 9. Table Functions: Converted PostgreSQL RETURN QUERY functions to Oracle SYS_REFCURSOR.
-- 10. Triggers & Functions: Standardized to Oracle PL/SQL syntax with '/' execution terminators.
-- ============================================================================

SET SERVEROUTPUT ON SIZE UNLIMITED;
SET LINESIZE 200;
SET PAGESIZE 100;
WHENEVER SQLERROR CONTINUE;

-- ============================================================================
-- SECTION 1: DDL TABLE DEFINITIONS (Dependency Order Preserved)
-- ============================================================================

-- 1. Currency Rates (Base currency exchange lookup)
CREATE TABLE currency_rates (
    currency_code VARCHAR2(10) PRIMARY KEY,
    rate_to_usd NUMBER(18, 6) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT chk_cr_rate CHECK (rate_to_usd > 0)
);

-- 2. Users (Core user accounts & preferences)
-- NOTE: PostgreSQL 'ON UPDATE CASCADE' is not supported in Oracle foreign keys and is omitted.
CREATE TABLE users (
    user_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    email VARCHAR2(255) UNIQUE NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    base_currency VARCHAR2(10) DEFAULT 'USD' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_users_currency FOREIGN KEY (base_currency) REFERENCES currency_rates (currency_code)
);

-- 3. Exchanges (Trading venues & stock markets)
CREATE TABLE exchanges (
    exchange_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    name VARCHAR2(100) NOT NULL,
    country VARCHAR2(100) NOT NULL,
    url VARCHAR2(500)
);

-- 4. Assets (Global catalog for stocks & crypto)
CREATE TABLE assets (
    asset_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    symbol VARCHAR2(20) UNIQUE NOT NULL,
    name VARCHAR2(150) NOT NULL,
    type VARCHAR2(20) NOT NULL,
    network VARCHAR2(100),
    contract_address VARCHAR2(255),
    ticker_exchange VARCHAR2(50),
    sector VARCHAR2(100),
    exchange_id RAW(16),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT chk_assets_type CHECK (type IN ('crypto', 'stock')),
    CONSTRAINT fk_assets_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges (exchange_id) ON DELETE SET NULL
);

-- 5. Ticker Stats (1:1 24h market summary metrics)
CREATE TABLE ticker_stats (
    asset_id RAW(16) PRIMARY KEY,
    price_per_unit NUMBER(18, 6) DEFAULT 0.0 NOT NULL,
    volume_24h NUMBER(24, 2) DEFAULT 0.0,
    high_24h NUMBER(18, 6) DEFAULT 0.0,
    low_24h NUMBER(18, 6) DEFAULT 0.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_ticker_stats_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE CASCADE
);

-- 6. Portfolios (User portfolio containers)
CREATE TABLE portfolios (
    portfolio_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id RAW(16) NOT NULL,
    name VARCHAR2(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_portfolios_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- 7. Holdings (Active asset positions in portfolios)
CREATE TABLE holdings (
    holding_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    portfolio_id RAW(16) NOT NULL,
    asset_id RAW(16),
    symbol VARCHAR2(20) NOT NULL,
    name VARCHAR2(150) NOT NULL,
    type VARCHAR2(20) NOT NULL,
    quantity NUMBER(24, 8) NOT NULL,
    average_buy_price NUMBER(18, 6) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT chk_holdings_type CHECK (type IN ('crypto', 'stock')),
    CONSTRAINT chk_holdings_quantity CHECK (quantity > 0),
    CONSTRAINT chk_holdings_avg_price CHECK (average_buy_price >= 0),
    CONSTRAINT fk_holdings_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (portfolio_id) ON DELETE CASCADE,
    CONSTRAINT fk_holdings_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL,
    CONSTRAINT uq_portfolio_symbol UNIQUE (portfolio_id, symbol)
);

-- 8. Transactions (Immutable trade execution ledger)
CREATE TABLE transactions (
    transaction_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id RAW(16) NOT NULL,
    portfolio_id RAW(16) NOT NULL,
    asset_id RAW(16),
    symbol VARCHAR2(20) NOT NULL,
    type VARCHAR2(20) NOT NULL,
    quantity NUMBER(24, 8) NOT NULL,
    price_at_transaction NUMBER(18, 6) NOT NULL,
    network_hash VARCHAR2(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT chk_tx_type CHECK (type IN ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT')),
    CONSTRAINT chk_tx_quantity CHECK (quantity > 0),
    CONSTRAINT chk_tx_price CHECK (price_at_transaction >= 0),
    CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_tx_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (portfolio_id) ON DELETE CASCADE,
    CONSTRAINT fk_tx_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL
);

-- 9. Portfolio Performance (Valuation & PnL timeseries snapshots)
CREATE TABLE portfolio_performance (
    performance_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    portfolio_id RAW(16) NOT NULL,
    total_value NUMBER(18, 2) NOT NULL,
    total_profit_loss NUMBER(18, 2) NOT NULL,
    total_profit_loss_pct NUMBER(8, 4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_perf_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (portfolio_id) ON DELETE CASCADE
);

-- 10. Watchlists (User-created asset tracking lists)
CREATE TABLE watchlists (
    watchlist_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id RAW(16) NOT NULL,
    name VARCHAR2(100) NOT NULL,
    creation_date TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_watchlists_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- 11. Watchlist Items (Assets assigned to watchlists)
CREATE TABLE watchlist_items (
    item_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    watchlist_id RAW(16) NOT NULL,
    symbol VARCHAR2(20) NOT NULL,
    asset_id RAW(16),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_wl_items_watchlist FOREIGN KEY (watchlist_id) REFERENCES watchlists (watchlist_id) ON DELETE CASCADE,
    CONSTRAINT fk_wl_items_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL,
    CONSTRAINT uq_watchlist_symbol UNIQUE (watchlist_id, symbol)
);

-- 12. Alerts (Price monitoring rules)
CREATE TABLE alerts (
    alert_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id RAW(16) NOT NULL,
    symbol VARCHAR2(20) NOT NULL,
    asset_id RAW(16),
    threshold NUMBER(18, 6) NOT NULL,
    direction VARCHAR2(10) NOT NULL,
    enabled NUMBER(1) DEFAULT 1 NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT chk_alerts_threshold CHECK (threshold > 0),
    CONSTRAINT chk_alerts_direction CHECK (direction IN ('ABOVE', 'BELOW')),
    CONSTRAINT chk_alerts_enabled CHECK (enabled IN (0, 1)),
    CONSTRAINT fk_alerts_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_alerts_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL
);

-- 13. Notifications (Dispatched alert logs)
CREATE TABLE notifications (
    notification_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    alert_id RAW(16) NOT NULL,
    user_id RAW(16) NOT NULL,
    channel VARCHAR2(20) NOT NULL,
    status VARCHAR2(20) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT chk_notif_channel CHECK (channel IN ('EMAIL', 'SMS', 'PUSH', 'IN_APP')),
    CONSTRAINT chk_notif_status CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    CONSTRAINT fk_notif_alert FOREIGN KEY (alert_id) REFERENCES alerts (alert_id) ON DELETE CASCADE,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- 14. Price History (Granular market tick historical points)
CREATE TABLE price_history (
    history_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    symbol VARCHAR2(20) NOT NULL,
    asset_id RAW(16),
    price NUMBER(18, 6) NOT NULL,
    volume NUMBER(24, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_history_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL
);

-- 15. News Articles (Market headlines and metadata)
CREATE TABLE news_articles (
    article_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    headline VARCHAR2(500) NOT NULL,
    source VARCHAR2(100) NOT NULL,
    url VARCHAR2(1000) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 16. News Article Assets (Junction mapping articles to assets)
CREATE TABLE news_article_assets (
    article_id RAW(16) NOT NULL,
    asset_id RAW(16) NOT NULL,
    PRIMARY KEY (article_id, asset_id),
    CONSTRAINT fk_naa_article FOREIGN KEY (article_id) REFERENCES news_articles (article_id) ON DELETE CASCADE,
    CONSTRAINT fk_naa_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE CASCADE
);

-- 17. Price Cache (High-speed API quote caching with JSON metadata)
-- NOTE: JSONB is represented as CLOB with an IS JSON check constraint.
CREATE TABLE price_cache (
    cache_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    symbol VARCHAR2(20) NOT NULL,
    asset_type VARCHAR2(20) NOT NULL,
    price_usd NUMBER(18, 6) NOT NULL,
    high_24h NUMBER(18, 6),
    low_24h NUMBER(18, 6),
    volume_24h NUMBER(24, 2),
    change_24h NUMBER(8, 4),
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    expire_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata CLOB,
    CONSTRAINT chk_cache_asset_type CHECK (asset_type IN ('crypto', 'stock')),
    CONSTRAINT chk_cache_json CHECK (metadata IS JSON),
    CONSTRAINT uq_cache_symbol_type UNIQUE (symbol, asset_type)
);

-- 18. Audit Logs (Immutable security and operations log)
CREATE TABLE audit_logs (
    log_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id RAW(16) NOT NULL,
    action VARCHAR2(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- ============================================================================
-- SECTION 2: INDEXES FOR PERFORMANCE & LOOKUPS
-- ============================================================================

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_assets_symbol ON assets (symbol);
CREATE INDEX idx_assets_type ON assets (type);
CREATE INDEX idx_portfolios_user_id ON portfolios (user_id);
CREATE INDEX idx_holdings_portfolio_id ON holdings (portfolio_id);
CREATE INDEX idx_holdings_symbol ON holdings (symbol);
CREATE INDEX idx_tx_portfolio_time ON transactions (portfolio_id, timestamp DESC);
CREATE INDEX idx_tx_user ON transactions (user_id);
CREATE INDEX idx_perf_portfolio_time ON portfolio_performance (portfolio_id, timestamp DESC);
CREATE INDEX idx_watchlist_items_watchlist ON watchlist_items (watchlist_id);
CREATE INDEX idx_alerts_user_enabled ON alerts (user_id, enabled);
CREATE INDEX idx_price_history_sym_time ON price_history (symbol, timestamp DESC);
CREATE INDEX idx_price_cache_expire ON price_cache (expire_at);
CREATE INDEX idx_audit_user_time ON audit_logs (user_id, timestamp DESC);

-- ============================================================================
-- SECTION 3: PL/SQL TRIGGERS
-- ============================================================================

-- Trigger 1: Automatically update updated_at on holdings table modification
CREATE OR REPLACE TRIGGER trg_update_holdings_timestamp
BEFORE UPDATE ON holdings
FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

-- Trigger 2: Automatically write an immutable audit log upon trade execution
CREATE OR REPLACE TRIGGER trg_log_transaction_activity
AFTER INSERT ON transactions
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (
        log_id,
        user_id,
        action,
        timestamp
    ) VALUES (
        SYS_GUID(),
        :NEW.user_id,
        'TRADE_EXECUTION: ' || :NEW.type || ' ' || TO_CHAR(:NEW.quantity) || ' ' || :NEW.symbol || ' @ ' || TO_CHAR(:NEW.price_at_transaction) || ' (Portfolio: ' || RAWTOHEX(:NEW.portfolio_id) || ')',
        COALESCE(:NEW.timestamp, SYSTIMESTAMP)
    );
END;
/

-- ============================================================================
-- SECTION 4: PL/SQL STORED FUNCTIONS & PROCEDURES
-- ============================================================================

-- Function 1: Atomic Upsert of Holding Position with Weighted Average Cost Calculation
CREATE OR REPLACE FUNCTION upsert_holding(
    p_portfolio_id IN RAW,
    p_asset_id     IN RAW,
    p_symbol       IN VARCHAR2,
    p_name         IN VARCHAR2,
    p_type         IN VARCHAR2,
    p_quantity     IN NUMBER,
    p_buy_price    IN NUMBER
)
RETURN RAW
IS
    v_holding_id RAW(16);
BEGIN
    -- Input validation
    IF p_quantity <= 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'Holding quantity must be strictly positive (received: ' || TO_CHAR(p_quantity) || ')');
    END IF;

    IF p_buy_price < 0 THEN
        RAISE_APPLICATION_ERROR(-20002, 'Holding purchase price cannot be negative (received: ' || TO_CHAR(p_buy_price) || ')');
    END IF;

    IF p_type NOT IN ('crypto', 'stock') THEN
        RAISE_APPLICATION_ERROR(-20003, 'Invalid asset type "' || p_type || '". Must be "crypto" or "stock"');
    END IF;

    -- Perform atomic MERGE with weighted average cost basis recalculation
    MERGE INTO holdings h
    USING (
        SELECT 
            p_portfolio_id AS portfolio_id,
            p_asset_id     AS asset_id,
            p_symbol       AS symbol,
            p_name         AS name,
            p_type         AS type,
            p_quantity     AS quantity,
            p_buy_price    AS buy_price
        FROM dual
    ) src
    ON (h.portfolio_id = src.portfolio_id AND h.symbol = src.symbol)
    WHEN MATCHED THEN
        UPDATE SET 
            h.quantity = h.quantity + src.quantity,
            h.average_buy_price = ((h.quantity * h.average_buy_price) + (src.quantity * src.buy_price)) / (h.quantity + src.quantity),
            h.updated_at = SYSTIMESTAMP
    WHEN NOT MATCHED THEN
        INSERT (holding_id, portfolio_id, asset_id, symbol, name, type, quantity, average_buy_price, updated_at)
        VALUES (SYS_GUID(), src.portfolio_id, src.asset_id, src.symbol, src.name, src.type, src.quantity, src.buy_price, SYSTIMESTAMP);

    SELECT holding_id INTO v_holding_id
    FROM holdings
    WHERE portfolio_id = p_portfolio_id AND symbol = p_symbol;

    RETURN v_holding_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE_APPLICATION_ERROR(-20004, 'Failed to upsert holding for symbol ' || p_symbol || ': ' || SQLERRM);
END upsert_holding;
/

-- Function 2: Atomic Trade Recording, Balance Validation, and Holding State Synchronization
CREATE OR REPLACE FUNCTION record_transaction_and_update_holding(
    p_user_id      IN RAW,
    p_portfolio_id IN RAW,
    p_asset_id     IN RAW,
    p_symbol       IN VARCHAR2,
    p_type         IN VARCHAR2,
    p_quantity     IN NUMBER,
    p_price        IN NUMBER,
    p_network_hash IN VARCHAR2 DEFAULT NULL,
    p_asset_name   IN VARCHAR2 DEFAULT NULL,
    p_asset_type   IN VARCHAR2 DEFAULT NULL
)
RETURN RAW
IS
    v_tx_id          RAW(16);
    v_current_qty    NUMBER(24, 8);
    v_current_avg    NUMBER(18, 6);
    v_resolved_name  VARCHAR2(150);
    v_resolved_type  VARCHAR2(20);
BEGIN
    -- Validate inputs
    IF p_quantity <= 0 THEN
        RAISE_APPLICATION_ERROR(-20010, 'Transaction quantity must be strictly greater than 0');
    END IF;

    IF p_price < 0 THEN
        RAISE_APPLICATION_ERROR(-20011, 'Transaction price cannot be negative');
    END IF;

    IF p_type NOT IN ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT') THEN
        RAISE_APPLICATION_ERROR(-20012, 'Invalid transaction type: ' || p_type || '. Expected BUY, SELL, TRANSFER_IN, or TRANSFER_OUT');
    END IF;

    -- Resolve asset metadata if not supplied
    IF p_asset_name IS NULL OR p_asset_type IS NULL THEN
        BEGIN
            SELECT name, type INTO v_resolved_name, v_resolved_type
            FROM assets
            WHERE symbol = p_symbol
              AND ROWNUM = 1;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                v_resolved_name := p_symbol;
                v_resolved_type := 'crypto';
        END;
        v_resolved_name := COALESCE(v_resolved_name, p_symbol);
        v_resolved_type := COALESCE(v_resolved_type, 'crypto');
    ELSE
        v_resolved_name := p_asset_name;
        v_resolved_type := p_asset_type;
    END IF;

    -- Handle Holdings Adjustment
    IF p_type IN ('BUY', 'TRANSFER_IN') THEN
        MERGE INTO holdings h
        USING (
            SELECT 
                p_portfolio_id  AS portfolio_id,
                p_asset_id      AS asset_id,
                p_symbol        AS symbol,
                v_resolved_name AS name,
                v_resolved_type AS type,
                p_quantity      AS quantity,
                p_price         AS price
            FROM dual
        ) src
        ON (h.portfolio_id = src.portfolio_id AND h.symbol = src.symbol)
        WHEN MATCHED THEN
            UPDATE SET
                h.quantity = h.quantity + src.quantity,
                h.average_buy_price = CASE 
                    WHEN (h.quantity + src.quantity) > 0 
                    THEN ((h.quantity * h.average_buy_price) + (src.quantity * src.price)) / (h.quantity + src.quantity)
                    ELSE h.average_buy_price
                END,
                h.updated_at = SYSTIMESTAMP
        WHEN NOT MATCHED THEN
            INSERT (holding_id, portfolio_id, asset_id, symbol, name, type, quantity, average_buy_price, updated_at)
            VALUES (SYS_GUID(), src.portfolio_id, src.asset_id, src.symbol, src.name, src.type, src.quantity, src.price, SYSTIMESTAMP);

    ELSIF p_type IN ('SELL', 'TRANSFER_OUT') THEN
        BEGIN
            SELECT quantity, average_buy_price INTO v_current_qty, v_current_avg
            FROM holdings
            WHERE portfolio_id = p_portfolio_id AND symbol = p_symbol;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(-20013, 'Cannot execute ' || p_type || ': No existing position for symbol ' || p_symbol || ' in portfolio');
        END;

        IF v_current_qty < p_quantity THEN
            RAISE_APPLICATION_ERROR(-20014, 'Insufficient position balance: attempted to ' || p_type || ' ' || TO_CHAR(p_quantity) || ' ' || p_symbol || ', but current holding is ' || TO_CHAR(v_current_qty));
        ELSIF v_current_qty = p_quantity THEN
            DELETE FROM holdings
            WHERE portfolio_id = p_portfolio_id AND symbol = p_symbol;
        ELSE
            UPDATE holdings
            SET quantity = quantity - p_quantity,
                updated_at = SYSTIMESTAMP
            WHERE portfolio_id = p_portfolio_id AND symbol = p_symbol;
        END IF;
    END IF;

    -- Insert Transaction Ledger Record
    v_tx_id := SYS_GUID();
    INSERT INTO transactions (
        transaction_id,
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
        v_tx_id,
        p_user_id,
        p_portfolio_id,
        p_asset_id,
        p_symbol,
        p_type,
        p_quantity,
        p_price,
        p_network_hash,
        SYSTIMESTAMP
    );

    RETURN v_tx_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE_APPLICATION_ERROR(-20015, 'Transaction execution failed and state rolled back: ' || SQLERRM);
END record_transaction_and_update_holding;
/

-- Function 3: Active Price Alerts Evaluation and Notification Dispatch
CREATE OR REPLACE FUNCTION check_price_alerts
RETURN NUMBER
IS
    v_triggered_count NUMBER := 0;
    v_current_price   NUMBER(18, 6);
BEGIN
    FOR v_alert IN (
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
        WHERE al.enabled = 1
    ) LOOP
        BEGIN
            v_current_price := v_alert.current_price;

            IF v_current_price IS NOT NULL THEN
                IF (v_alert.direction = 'ABOVE' AND v_current_price >= v_alert.threshold) OR
                   (v_alert.direction = 'BELOW' AND v_current_price <= v_alert.threshold) THEN

                    -- Insert Notification Record
                    INSERT INTO notifications (
                        notification_id,
                        alert_id,
                        user_id,
                        channel,
                        status,
                        sent_at
                    ) VALUES (
                        SYS_GUID(),
                        v_alert.alert_id,
                        v_alert.user_id,
                        'IN_APP',
                        'PENDING',
                        SYSTIMESTAMP
                    );

                    -- Deactivate Alert & Record Trigger Timestamp
                    UPDATE alerts
                    SET enabled = 0,
                        triggered_at = SYSTIMESTAMP
                    WHERE alert_id = v_alert.alert_id;

                    v_triggered_count := v_triggered_count + 1;
                END IF;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Isolate failure to single alert so entire loop execution completes
                DBMS_OUTPUT.PUT_LINE('WARNING: Error evaluating alert ID ' || RAWTOHEX(v_alert.alert_id) || ' for symbol ' || v_alert.symbol || ': ' || SQLERRM);
        END;
    END LOOP;

    RETURN v_triggered_count;
END check_price_alerts;
/

-- Function 4: Live Portfolio Valuation and Real-Time Gains/Losses (Returns SYS_REFCURSOR)
-- NOTE: In Oracle PL/SQL, queries returning result sets are cleanly returned via SYS_REFCURSOR.
CREATE OR REPLACE FUNCTION get_portfolio_valuation(p_portfolio_id IN RAW)
RETURN SYS_REFCURSOR
IS
    p_cursor SYS_REFCURSOR;
BEGIN
    OPEN p_cursor FOR
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
        LEFT JOIN price_cache pc ON h.symbol = pc.symbol AND pc.expire_at > SYSTIMESTAMP
        WHERE h.portfolio_id = p_portfolio_id
        ORDER BY market_value DESC;
        
    RETURN p_cursor;
END get_portfolio_valuation;
/

-- Function 5: Automated Portfolio Valuation Performance Snapshot Recorder
CREATE OR REPLACE FUNCTION record_portfolio_snapshot(p_portfolio_id IN RAW)
RETURN RAW
IS
    v_total_value   NUMBER(18, 2) := 0.0;
    v_total_cost    NUMBER(18, 2) := 0.0;
    v_total_pnl     NUMBER(18, 2) := 0.0;
    v_total_pnl_pct NUMBER(8, 4) := 0.0;
    v_perf_id       RAW(16);
BEGIN
    -- Calculate current portfolio valuation aggregates
    SELECT 
        NVL(SUM(h.quantity * NVL(pc.price_usd, ts.price_per_unit)), 0.0),
        NVL(SUM(h.quantity * h.average_buy_price), 0.0)
    INTO v_total_value, v_total_cost
    FROM holdings h
    LEFT JOIN assets a ON h.symbol = a.symbol
    LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
    LEFT JOIN price_cache pc ON h.symbol = pc.symbol AND pc.expire_at > SYSTIMESTAMP
    WHERE h.portfolio_id = p_portfolio_id;

    v_total_pnl := v_total_value - v_total_cost;

    IF v_total_cost > 0 THEN
        v_total_pnl_pct := ROUND(((v_total_pnl / v_total_cost) * 100.0), 4);
    ELSE
        v_total_pnl_pct := 0.0;
    END IF;

    -- Record snapshot in portfolio_performance
    v_perf_id := SYS_GUID();
    INSERT INTO portfolio_performance (
        performance_id,
        portfolio_id,
        total_value,
        total_profit_loss,
        total_profit_loss_pct,
        timestamp
    ) VALUES (
        v_perf_id,
        p_portfolio_id,
        v_total_value,
        v_total_pnl,
        v_total_pnl_pct,
        SYSTIMESTAMP
    );

    RETURN v_perf_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE_APPLICATION_ERROR(-20020, 'Failed to record performance snapshot for portfolio: ' || SQLERRM);
END record_portfolio_snapshot;
/

-- Function 6: Expire and Purge Stale Price Cache Routine
CREATE OR REPLACE FUNCTION expire_price_cache
RETURN NUMBER
IS
    v_deleted_count NUMBER := 0;
BEGIN
    DELETE FROM price_cache
    WHERE expire_at < SYSTIMESTAMP;

    v_deleted_count := SQL%ROWCOUNT;

    RETURN v_deleted_count;
EXCEPTION
    WHEN OTHERS THEN
        RAISE_APPLICATION_ERROR(-20030, 'Price cache expiration routine failed: ' || SQLERRM);
END expire_price_cache;
/

-- Function 7: Recalculate 24-Hour Ticker Statistics from Price History
CREATE OR REPLACE FUNCTION refresh_ticker_stats(p_asset_id IN RAW)
RETURN NUMBER
IS
    v_symbol       VARCHAR2(20);
    v_latest_price NUMBER(18, 6);
    v_high_24h     NUMBER(18, 6);
    v_low_24h      NUMBER(18, 6);
    v_volume_24h   NUMBER(24, 2);
BEGIN
    -- Find symbol for given asset
    BEGIN
        SELECT symbol INTO v_symbol
        FROM assets
        WHERE asset_id = p_asset_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20040, 'Asset with specified ID does not exist');
    END;

    -- Extract aggregates from price_history over the last 24 hours
    SELECT 
        MAX(ph.price),
        MIN(ph.price),
        NVL(SUM(ph.volume), 0.0)
    INTO v_high_24h, v_low_24h, v_volume_24h
    FROM price_history ph
    WHERE (ph.asset_id = p_asset_id OR ph.symbol = v_symbol)
      AND ph.timestamp >= SYSTIMESTAMP - INTERVAL '24' HOUR;

    -- Fetch the most recent recorded price
    BEGIN
        SELECT price INTO v_latest_price
        FROM (
            SELECT price
            FROM price_history ph
            WHERE (ph.asset_id = p_asset_id OR ph.symbol = v_symbol)
            ORDER BY ph.timestamp DESC
        )
        WHERE ROWNUM = 1;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            v_latest_price := NULL;
    END;

    -- If recent history exists, upsert into ticker_stats
    IF v_latest_price IS NOT NULL THEN
        MERGE INTO ticker_stats t
        USING (
            SELECT 
                p_asset_id                      AS asset_id,
                v_latest_price                  AS price_per_unit,
                NVL(v_volume_24h, 0.0)          AS volume_24h,
                NVL(v_high_24h, v_latest_price) AS high_24h,
                NVL(v_low_24h, v_latest_price)  AS low_24h,
                SYSTIMESTAMP                    AS updated_at
            FROM dual
        ) src
        ON (t.asset_id = src.asset_id)
        WHEN MATCHED THEN
            UPDATE SET 
                t.price_per_unit = src.price_per_unit,
                t.volume_24h     = src.volume_24h,
                t.high_24h       = src.high_24h,
                t.low_24h        = src.low_24h,
                t.updated_at     = src.updated_at
        WHEN NOT MATCHED THEN
            INSERT (asset_id, price_per_unit, volume_24h, high_24h, low_24h, updated_at)
            VALUES (src.asset_id, src.price_per_unit, src.volume_24h, src.high_24h, src.low_24h, src.updated_at);
            
        RETURN 1; -- Returns 1 for TRUE
    END IF;

    RETURN 0; -- Returns 0 for FALSE
EXCEPTION
    WHEN OTHERS THEN
        RAISE_APPLICATION_ERROR(-20041, 'Failed to refresh ticker stats: ' || SQLERRM);
END refresh_ticker_stats;
/

-- ============================================================================
-- SECTION 5: DEMONSTRATION DML STATEMENTS & SEED DATA (SQL*Plus Compatible)
-- ============================================================================

-- 1. Currency Rates Seed
INSERT INTO currency_rates (currency_code, rate_to_usd, updated_at) VALUES ('USD', 1.000000, SYSTIMESTAMP);
INSERT INTO currency_rates (currency_code, rate_to_usd, updated_at) VALUES ('EUR', 0.920000, SYSTIMESTAMP);
INSERT INTO currency_rates (currency_code, rate_to_usd, updated_at) VALUES ('GBP', 0.780000, SYSTIMESTAMP);
INSERT INTO currency_rates (currency_code, rate_to_usd, updated_at) VALUES ('INR', 83.500000, SYSTIMESTAMP);

-- 2. User Registration via PL/SQL Anonymous Block with RETURNING INTO
DECLARE
    v_user_id RAW(16);
BEGIN
    INSERT INTO users (email, password_hash, base_currency)
    VALUES ('investor@example.com', '$2b$12$e8uq...', 'USD')
    RETURNING user_id INTO v_user_id;
    
    DBMS_OUTPUT.PUT_LINE('User Registered with ID: ' || RAWTOHEX(v_user_id));
END;
/

COMMIT;
