-- ============================================================================
-- 08_core_timeseries_queries.sql
-- Live Crypto and Stock Analysis Platform - Core Operations & TimescaleDB Queries
-- Implements all 12 core operations specified in Digital Assignment requirements:
--   1. Asset catalog insertion and retrieval
--   2. Historical price recording
--   3. Selected asset price retrieval
--   4. Time-range filtering (chunk pruning demonstration)
--   5. Hourly & daily averages via time_bucket()
--   6. OHLCV candlestick aggregation (first, max, min, last)
--   7. Multi-asset comparative historical performance
--   8. Live portfolio valuation evaluation
--   9. Atomic transaction execution & holdings synchronization
--  10. Price alert evaluation and notification dispatch
--  11. Hypertable chunk and partition inspection
--  12. Continuous aggregates, compression & retention demonstration
-- ============================================================================

-- ============================================================================
-- OPERATION 1: Asset Catalog Management (Stocks & Cryptocurrencies)
-- ============================================================================
-- Retrieve all supported assets with exchange metadata and current 24h stats
SELECT 
    a.asset_id,
    a.symbol,
    a.name,
    a.type,
    a.ticker_exchange,
    e.name AS exchange_name,
    ts.price_per_unit AS latest_price,
    ts.high_24h,
    ts.low_24h,
    ts.volume_24h
FROM assets a
LEFT JOIN exchanges e ON a.exchange_id = e.exchange_id
LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
ORDER BY a.type DESC, a.symbol ASC;


-- ============================================================================
-- OPERATION 2: Recording Historical Asset Prices with Timestamps
-- ============================================================================
-- Insert real-time tick observation into the price_history hypertable
INSERT INTO price_history (history_id, symbol, asset_id, price, volume, timestamp)
VALUES (
    uuid_generate_v4(),
    'BTC',
    '22222222-2222-2222-2222-222222222221',
    64850.250000,
    4200000.00,
    CURRENT_TIMESTAMP
);


-- ============================================================================
-- OPERATION 3: Retrieving Historical Prices for a Selected Asset
-- ============================================================================
-- Fetch the latest 10 price points for Bitcoin (BTC)
SELECT 
    history_id,
    symbol,
    price,
    volume,
    timestamp
FROM price_history
WHERE symbol = 'BTC'
ORDER BY timestamp DESC
LIMIT 10;


-- ============================================================================
-- OPERATION 4: Filtering Price Records by Time Range (Chunk Pruning)
-- ============================================================================
-- Filter Ethereum prices within the last 48 hours.
-- In TimescaleDB, the execution engine skips all chunks outside this time window.
EXPLAIN (ANALYZE, COSTS OFF)
SELECT 
    symbol,
    price,
    volume,
    timestamp
FROM price_history
WHERE symbol = 'ETH'
  AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '48 hours'
ORDER BY timestamp DESC;


-- ============================================================================
-- OPERATION 5: Hourly and Daily Price Averages via time_bucket()
-- ============================================================================
-- Calculate 4-hour rolling averages and volume for NVDA using TimescaleDB time_bucket()
SELECT 
    time_bucket('4 hours', timestamp) AS four_hour_bucket,
    symbol,
    COUNT(*) AS tick_count,
    ROUND(AVG(price)::NUMERIC, 2) AS avg_price,
    ROUND(SUM(volume)::NUMERIC, 2) AS total_volume
FROM price_history
WHERE symbol = 'NVDA'
  AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY four_hour_bucket, symbol
ORDER BY four_hour_bucket DESC;


-- ============================================================================
-- OPERATION 6: OHLCV Candlesticks (first, max, min, last)
-- ============================================================================
-- Construct standard 1-day financial Candlesticks (Open, High, Low, Close, Volume)
-- using TimescaleDB first() and last() analytical state functions
SELECT 
    time_bucket('1 day', timestamp) AS trading_day,
    symbol,
    first(price, timestamp) AS open_price,
    max(price) AS high_price,
    min(price) AS low_price,
    last(price, timestamp) AS close_price,
    ROUND(sum(volume)::NUMERIC, 2) AS daily_volume,
    count(*) AS observation_count
FROM price_history
WHERE symbol IN ('BTC', 'ETH', 'AAPL', 'NVDA')
  AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY trading_day, symbol
ORDER BY trading_day DESC, symbol ASC;


-- ============================================================================
-- OPERATION 7: Multi-Asset Historical Performance Comparison
-- ============================================================================
-- Compare normalized return performance (% gain/loss) from the start of the period
WITH PeriodBounds AS (
    SELECT 
        symbol,
        first(price, timestamp) AS starting_price,
        last(price, timestamp) AS ending_price,
        min(price) AS cycle_low,
        max(price) AS cycle_high
    FROM price_history
    WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
    GROUP BY symbol
)
SELECT 
    symbol,
    starting_price,
    ending_price,
    cycle_low,
    cycle_high,
    ROUND((((ending_price - starting_price) / starting_price) * 100.0)::NUMERIC, 2) AS pct_change_7d
FROM PeriodBounds
ORDER BY pct_change_7d DESC;


-- ============================================================================
-- OPERATION 8: Live Portfolio Valuation Evaluation
-- ============================================================================
-- Evaluate multi-asset portfolio valuation for 'Growth & Multi-Asset Fund'
-- Reproduces the DA-2 Verification 2 output grid
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
-- OPERATION 9: Atomic Transaction Recording & Holdings Synchronization
-- ============================================================================
-- Execute a new trade: BUY 20 shares of AAPL @ $225.00
-- This calls record_transaction_and_update_holding(), synchronizes holdings,
-- recalculates average buy price, and logs the execution in audit_logs.
SELECT record_transaction_and_update_holding(
    '00000000-0000-0000-0000-000000000001'::UUID,
    '11111111-1111-1111-1111-111111111111'::UUID,
    '22222222-2222-2222-2222-222222222225'::UUID,
    'AAPL',
    'BUY',
    20.00000000,
    225.000000,
    'TX-MANUAL-VERIFY-001',
    'Apple Inc.',
    'stock'
) AS executed_tx_id;

-- Verify updated holding position (quantity should now be 70, with updated avg price)
SELECT symbol, quantity, average_buy_price, updated_at
FROM holdings
WHERE portfolio_id = '11111111-1111-1111-1111-111111111111'
  AND symbol = 'AAPL';

-- Verify automatic audit log generation by trigger
SELECT log_id, user_id, action, timestamp
FROM audit_logs
WHERE action LIKE '%AAPL%'
ORDER BY timestamp DESC
LIMIT 1;


-- ============================================================================
-- OPERATION 10: Price Alert Evaluation & Notification Dispatch
-- ============================================================================
-- Evaluate alerts against live cached quotes / ticker stats
SELECT check_price_alerts() AS alerts_triggered_count;

-- Inspect newly generated notification log
SELECT 
    n.notification_id,
    n.alert_id,
    n.channel,
    n.status,
    n.sent_at,
    a.symbol,
    a.threshold,
    a.direction
FROM notifications n
JOIN alerts a ON n.alert_id = a.alert_id
ORDER BY n.sent_at DESC
LIMIT 5;


-- ============================================================================
-- OPERATION 11: Hypertable Chunk & Time Partition Inspection
-- ============================================================================
-- Query TimescaleDB metadata to inspect created chunks, ranges, and sizes
SELECT 
    chunk_name,
    range_start,
    range_end,
    is_compressed
FROM timescaledb_information.chunks
WHERE hypertable_name = 'price_history'
ORDER BY range_start DESC;

-- Detailed chunk size and disk usage breakdown
SELECT 
    hypertable_name,
    chunk_name,
    pg_size_pretty(total_bytes) AS total_chunk_size,
    pg_size_pretty(data_bytes) AS table_data_size,
    pg_size_pretty(index_bytes) AS chunk_index_size
FROM timescaledb_information.chunks
WHERE hypertable_name = 'price_history'
ORDER BY range_start DESC;


-- ============================================================================
-- OPERATION 12: TimescaleDB Advanced Features Demonstration
-- ============================================================================
-- A. Query pre-materialized Continuous Aggregate View (Instant OHLCV candles)
SELECT 
    candle_bucket,
    symbol,
    open_price,
    high_price,
    low_price,
    close_price,
    total_volume,
    tick_count
FROM price_history_hourly_candlestick
ORDER BY candle_bucket DESC, symbol ASC
LIMIT 10;

-- B. Manually Compress Chunks older than 7 days
SELECT compress_chunk(chunk_schema || '.' || chunk_name)
FROM timescaledb_information.chunks
WHERE hypertable_name = 'price_history'
  AND range_end < (CURRENT_TIMESTAMP - INTERVAL '7 days')
  AND NOT is_compressed;

-- C. Verify Compression Statistics and Space Savings
SELECT 
    'price_history' AS hypertable_name,
    pg_size_pretty(before_compression_total_bytes) AS uncompressed_size,
    pg_size_pretty(after_compression_total_bytes) AS compressed_size,
    ROUND((1.0 - (after_compression_total_bytes::NUMERIC / NULLIF(before_compression_total_bytes, 0))) * 100.0, 2) AS space_saving_pct
FROM hypertable_compression_stats('price_history');
