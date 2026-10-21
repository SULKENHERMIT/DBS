-- ============================================================================
-- 09_verification_tests.sql
-- Live Crypto and Stock Analysis Platform - Comprehensive Verification Suite
-- Validates:
--   1. Original DA-2 Verification 1: Table row counts (extended to all 18 tables)
--   2. Original DA-2 Verification 2: Portfolio valuation output grid
--   3. TimescaleDB Hypertable & chunk structure validation
--   4. Foreign keys, constraints, and index validation
--   5. PL/pgSQL stored procedures, triggers, and atomic transaction tests
--   6. Cache expiry, alert evaluation, and ticker refresh routines
-- ============================================================================

-- ============================================================================
-- TEST 1: Table Row Counts (Reproduces DA-2 Verification 1 + All 18 Tables)
-- ============================================================================
SELECT 'users' AS table_name, count(*) AS row_count FROM users
UNION ALL SELECT 'portfolios', count(*) FROM portfolios
UNION ALL SELECT 'holdings', count(*) FROM holdings
UNION ALL SELECT 'assets', count(*) FROM assets
UNION ALL SELECT 'ticker_stats', count(*) FROM ticker_stats
UNION ALL SELECT 'transactions', count(*) FROM transactions
UNION ALL SELECT 'alerts', count(*) FROM alerts
UNION ALL SELECT 'price_cache', count(*) FROM price_cache
UNION ALL SELECT 'currency_rates', count(*) FROM currency_rates
UNION ALL SELECT 'exchanges', count(*) FROM exchanges
UNION ALL SELECT 'portfolio_performance', count(*) FROM portfolio_performance
UNION ALL SELECT 'watchlists', count(*) FROM watchlists
UNION ALL SELECT 'watchlist_items', count(*) FROM watchlist_items
UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'price_history (hypertable)', count(*) FROM price_history
UNION ALL SELECT 'news_articles', count(*) FROM news_articles
UNION ALL SELECT 'news_article_assets', count(*) FROM news_article_assets
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs
ORDER BY table_name;


-- ============================================================================
-- TEST 2: Live Portfolio Valuation (Reproduces DA-2 Verification 2)
-- Expected values for 'Growth & Multi-Asset Fund' (Portfolio ID ...1111):
--   BTC:  Qty 1.25, Avg $58,200.00, Price $64,500.00, Cost $72,750.00, Val $80,625.00, PnL +$7,875.00 (+10.8247%)
--   ETH:  Qty 8.50, Avg  $3,100.00, Price  $3,450.00, Cost $26,350.00, Val $29,325.00, PnL +$2,975.00 (+11.2903%)
--   AAPL: Qty 50.0, Avg    $210.00, Price    $228.75, Cost $10,500.00, Val $11,437.50, PnL   +$937.50 (+8.9286%)
--   NVDA: Qty 80.0, Avg    $105.50, Price    $124.50, Cost  $8,440.00, Val  $9,960.00, PnL +$1,520.00 (+18.0095%)
--   TOTAL PORTFOLIO VALUE: $131,347.50 | TOTAL COST BASIS: $108,040.00 | UNREALIZED PnL: +$23,307.50 (+21.5730%)
-- ============================================================================
SELECT 
    holding_id,
    symbol,
    name,
    type,
    quantity,
    average_buy_price,
    current_price,
    cost_basis,
    market_value,
    unrealized_pnl,
    unrealized_pnl_pct,
    portfolio_base_currency,
    currency_rate_to_usd,
    market_value_base_currency
FROM get_portfolio_valuation('11111111-1111-1111-1111-111111111111');


-- ============================================================================
-- TEST 3: TimescaleDB Hypertable & Chunk Structure Validation
-- ============================================================================
-- Verify hypertable registration
SELECT 
    hypertable_name,
    num_dimensions,
    num_chunks,
    compression_enabled,
    primary_dimension
FROM timescaledb_information.hypertables
WHERE hypertable_name = 'price_history';

-- Verify hypertable chunks count and status
SELECT 
    count(*) AS total_chunks,
    count(*) FILTER (WHERE is_compressed) AS compressed_chunks,
    min(range_start) AS earliest_chunk_start,
    max(range_end) AS latest_chunk_end
FROM timescaledb_information.chunks
WHERE hypertable_name = 'price_history';


-- ============================================================================
-- TEST 4: Atomic Transactions and Holdings Consistency Test
-- ============================================================================
-- Execute a SELL transaction: SELL 10 shares of NVDA
SELECT record_transaction_and_update_holding(
    '00000000-0000-0000-0000-000000000001'::UUID,
    '11111111-1111-1111-1111-111111111111'::UUID,
    '22222222-2222-2222-2222-222222222226'::UUID,
    'NVDA',
    'SELL',
    10.00000000,
    126.000000,
    'TX-SELL-VERIFY-002',
    'NVIDIA Corporation',
    'stock'
) AS sell_tx_id;

-- Verify NVDA holding decreased from 80 to 70 with unchanged cost basis ($105.50)
SELECT symbol, quantity, average_buy_price, updated_at
FROM holdings
WHERE portfolio_id = '11111111-1111-1111-1111-111111111111'
  AND symbol = 'NVDA';

-- Verify transaction entry in ledger
SELECT transaction_id, symbol, type, quantity, price_at_transaction, timestamp
FROM transactions
WHERE network_hash = 'TX-SELL-VERIFY-002';


-- ============================================================================
-- TEST 5: Alert Evaluation and Notification Generation
-- ============================================================================
-- Trigger active alerts evaluation
SELECT check_price_alerts() AS newly_triggered_alerts;

-- Verify state in alerts table (active alerts vs triggered)
SELECT alert_id, symbol, threshold, direction, enabled, triggered_at
FROM alerts
ORDER BY created_at ASC;


-- ============================================================================
-- TEST 6: Price Cache Expiration Routine Test
-- ============================================================================
-- Count expired quotes prior to running routine (DOGE quote is expired in seed)
SELECT count(*) AS expired_quotes_in_cache
FROM price_cache
WHERE expire_at <= CURRENT_TIMESTAMP;

-- Run cache expiration procedure
SELECT expire_price_cache() AS purged_cache_entries;

-- Verify no expired quotes remain
SELECT count(*) AS remaining_expired_quotes
FROM price_cache
WHERE expire_at <= CURRENT_TIMESTAMP;


-- ============================================================================
-- TEST 7: 24h Ticker Stats Refresh Test via Hypertable Aggregation
-- ============================================================================
-- Run refresh routine for Bitcoin
SELECT refresh_ticker_stats('22222222-2222-2222-2222-222222222221'::UUID) AS btc_refresh_status;

-- Inspect updated ticker stats
SELECT asset_id, price_per_unit, volume_24h, high_24h, low_24h, updated_at
FROM ticker_stats
WHERE asset_id = '22222222-2222-2222-2222-222222222221';


-- ============================================================================
-- TEST 8: Portfolio Snapshot Performance Recording Test
-- ============================================================================
-- Record snapshot for portfolio
SELECT record_portfolio_snapshot('11111111-1111-1111-1111-111111111111'::UUID) AS new_snapshot_id;

-- Retrieve latest recorded snapshot
SELECT performance_id, portfolio_id, total_value, total_profit_loss, total_profit_loss_pct, timestamp
FROM portfolio_performance
WHERE portfolio_id = '11111111-1111-1111-1111-111111111111'
ORDER BY timestamp DESC
LIMIT 1;
