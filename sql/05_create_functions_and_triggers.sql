-- ============================================================================
-- 05_create_functions_and_triggers.sql
-- Live Crypto and Stock Analysis Platform - PL/pgSQL Functions & Triggers
-- Source of Truth: DA-2 Report (Screenshots 8-23, run_all.sql)
-- Preserves exact business logic, parameter types, error handling, atomic
-- transactions, alert dispatching, and portfolio valuation.
-- Compatible with TimescaleDB hypertables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRIGGER FUNCTION: update_holdings_timestamp()
-- Automatically updates holdings.updated_at timestamp on record modification
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
-- 2. TRIGGER FUNCTION: log_transaction_activity()
-- Automatically logs every trade execution into immutable audit_logs
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
        'TRADE_EXECUTION: ' || NEW.type || ' ' || NEW.quantity::TEXT || ' ' || NEW.symbol || ' @ ' || NEW.price_at_transaction::TEXT,
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
-- 3. STORED FUNCTION: upsert_holding()
-- Performs atomic position upsert with weighted-average cost basis calculation
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
RETURNS VOID
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
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to upsert holding for symbol % in portfolio %: %', p_symbol, p_portfolio_id, SQLERRM;
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. STORED FUNCTION: record_transaction_and_update_holding()
-- Atomic execution of trade (BUY, SELL, TRANSFER) with holding synchronization
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
            RAISE EXCEPTION 'Insufficient position balance: attempted to % %, but current holding is %', p_type, p_quantity, v_current_qty;
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
-- 5. STORED FUNCTION: check_price_alerts()
-- Evaluates active price threshold alerts against live cache / ticker stats
-- and dispatches notifications
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
-- 6. STORED FUNCTION: get_portfolio_valuation()
-- Real-time multi-asset portfolio valuation with cost basis, market value,
-- unrealized profit/loss, and base-currency conversion
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
            THEN (((COALESCE(pc.price_usd, ts.price_per_unit, 0.0) - h.average_buy_price) / h.average_buy_price) * 100.0)::NUMERIC(18, 4)
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
-- 7. STORED FUNCTION: record_portfolio_snapshot()
-- Computes aggregated portfolio metrics and stores snapshot in portfolio_performance
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

    -- Record snapshot into portfolio_performance
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
-- 8. STORED FUNCTION: expire_price_cache()
-- Purges stale quotes from price_cache and returns deleted count
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_price_cache()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
BEGIN
    DELETE FROM price_cache
    WHERE expire_at <= CURRENT_TIMESTAMP;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Price cache expiration routine failed: %', SQLERRM;
END;
$$;


-- ----------------------------------------------------------------------------
-- 9. STORED FUNCTION: refresh_ticker_stats()
-- Recalculates 24-hour high, low, volume and latest price from price_history
-- Benefits from TimescaleDB chunk pruning on price_history.timestamp
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
    -- TimescaleDB automatically prunes chunks older than 24 hours!
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
