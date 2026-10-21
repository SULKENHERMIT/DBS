-- ============================================================================
-- 07_seed_timeseries_extended.sql
-- Live Crypto and Stock Analysis Platform - Extended Time-Series Dataset
-- EXPLICIT LABEL: GENERATED SAMPLE DATA (SYNTHETIC MARKET OBSERVATIONS)
-- Purpose: Populates multi-day historical price points across multiple chunks
-- to thoroughly test and demonstrate TimescaleDB features:
--   - Multi-chunk hypertable organization
--   - time_bucket() hourly and daily aggregations
--   - first() and last() Open/Close price candlestick generation
--   - Hypertable chunk pruning and compression policies
-- ============================================================================

-- Generate hourly price ticks for the past 14 days across all 6 platform assets.
-- Using deterministic mathematical functions to ensure reproducible test runs.

INSERT INTO price_history (history_id, symbol, asset_id, price, volume, timestamp)
SELECT
    uuid_generate_v4() AS history_id,
    'BTC' AS symbol,
    '22222222-2222-2222-2222-222222222221'::UUID AS asset_id,
    ROUND((60000.0 + 3500.0 * sin(extract(epoch from gs)/86400.0) + 1200.0 * cos(extract(epoch from gs)/14400.0))::NUMERIC, 2) AS price,
    ROUND((40000000.0 + 25000000.0 * abs(sin(extract(epoch from gs)/43200.0)))::NUMERIC, 2) AS volume,
    gs AS timestamp
FROM generate_series(
    CURRENT_TIMESTAMP - INTERVAL '14 days',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    INTERVAL '1 hour'
) AS gs;

INSERT INTO price_history (history_id, symbol, asset_id, price, volume, timestamp)
SELECT
    uuid_generate_v4() AS history_id,
    'ETH' AS symbol,
    '22222222-2222-2222-2222-222222222222'::UUID AS asset_id,
    ROUND((3100.0 + 250.0 * sin(extract(epoch from gs)/86400.0) + 90.0 * cos(extract(epoch from gs)/14400.0))::NUMERIC, 2) AS price,
    ROUND((15000000.0 + 10000000.0 * abs(cos(extract(epoch from gs)/43200.0)))::NUMERIC, 2) AS volume,
    gs AS timestamp
FROM generate_series(
    CURRENT_TIMESTAMP - INTERVAL '14 days',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    INTERVAL '1 hour'
) AS gs;

INSERT INTO price_history (history_id, symbol, asset_id, price, volume, timestamp)
SELECT
    uuid_generate_v4() AS history_id,
    'SOL' AS symbol,
    '22222222-2222-2222-2222-222222222224'::UUID AS asset_id,
    ROUND((135.0 + 15.0 * sin(extract(epoch from gs)/86400.0) + 6.0 * cos(extract(epoch from gs)/10800.0))::NUMERIC, 2) AS price,
    ROUND((3500000.0 + 2000000.0 * abs(sin(extract(epoch from gs)/21600.0)))::NUMERIC, 2) AS volume,
    gs AS timestamp
FROM generate_series(
    CURRENT_TIMESTAMP - INTERVAL '14 days',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    INTERVAL '1 hour'
) AS gs;

INSERT INTO price_history (history_id, symbol, asset_id, price, volume, timestamp)
SELECT
    uuid_generate_v4() AS history_id,
    'AAPL' AS symbol,
    '22222222-2222-2222-2222-222222222225'::UUID AS asset_id,
    ROUND((215.0 + 14.0 * sin(extract(epoch from gs)/86400.0) + 4.0 * cos(extract(epoch from gs)/28800.0))::NUMERIC, 2) AS price,
    ROUND((50000000.0 + 20000000.0 * abs(sin(extract(epoch from gs)/43200.0)))::NUMERIC, 2) AS volume,
    gs AS timestamp
FROM generate_series(
    CURRENT_TIMESTAMP - INTERVAL '14 days',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    INTERVAL '1 hour'
) AS gs;

INSERT INTO price_history (history_id, symbol, asset_id, price, volume, timestamp)
SELECT
    uuid_generate_v4() AS history_id,
    'NVDA' AS symbol,
    '22222222-2222-2222-2222-222222222226'::UUID AS asset_id,
    ROUND((112.0 + 15.0 * sin(extract(epoch from gs)/86400.0) + 5.0 * cos(extract(epoch from gs)/14400.0))::NUMERIC, 2) AS price,
    ROUND((80000000.0 + 35000000.0 * abs(cos(extract(epoch from gs)/28800.0)))::NUMERIC, 2) AS volume,
    gs AS timestamp
FROM generate_series(
    CURRENT_TIMESTAMP - INTERVAL '14 days',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    INTERVAL '1 hour'
) AS gs;

INSERT INTO price_history (history_id, symbol, asset_id, price, volume, timestamp)
SELECT
    uuid_generate_v4() AS history_id,
    'TSLA' AS symbol,
    '22222222-2222-2222-2222-222222222227'::UUID AS asset_id,
    ROUND((230.0 + 18.0 * sin(extract(epoch from gs)/86400.0) + 7.0 * cos(extract(epoch from gs)/21600.0))::NUMERIC, 2) AS price,
    ROUND((55000000.0 + 25000000.0 * abs(sin(extract(epoch from gs)/43200.0)))::NUMERIC, 2) AS volume,
    gs AS timestamp
FROM generate_series(
    CURRENT_TIMESTAMP - INTERVAL '14 days',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    INTERVAL '1 hour'
) AS gs;

-- Refresh continuous aggregate to incorporate extended data
CALL refresh_continuous_aggregate('price_history_hourly_candlestick', NULL, NULL);

-- Summary verification of generated time-series data
SELECT 
    symbol,
    COUNT(*) AS total_ticks,
    MIN(timestamp) AS earliest_record,
    MAX(timestamp) AS latest_record,
    MIN(price) AS min_price,
    MAX(price) AS max_price,
    ROUND(AVG(price)::NUMERIC, 2) AS avg_price
FROM price_history
GROUP BY symbol
ORDER BY symbol;
