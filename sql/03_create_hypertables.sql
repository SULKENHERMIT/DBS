-- ============================================================================
-- 03_create_hypertables.sql
-- Live Crypto and Stock Analysis Platform - TimescaleDB Hypertables & Policies
-- Implements time-series partitioning, chunk intervals, continuous aggregates,
-- compression policies, and retention policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CONVERT price_history TO HYPERTABLE
-- ----------------------------------------------------------------------------
-- Partition price_history along the time dimension ('timestamp').
-- Chunk interval is set to 1 day, matching daily trading cycles and keeping
-- 24-hour analytical working sets localized in RAM.
SELECT create_hypertable(
    'price_history', 
    'timestamp', 
    if_not_exists => TRUE, 
    chunk_time_interval => INTERVAL '1 day'
);

-- ----------------------------------------------------------------------------
-- 2. CREATE CONTINUOUS AGGREGATE (HOURLY OHLCV CANDLESTICKS)
-- ----------------------------------------------------------------------------
-- Pre-materializes hourly Open-High-Low-Close-Volume (OHLCV) bars using
-- TimescaleDB analytical functions: time_bucket(), first(), and last().
CREATE MATERIALIZED VIEW IF NOT EXISTS price_history_hourly_candlestick
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', timestamp) AS candle_bucket,
    symbol,
    asset_id,
    first(price, timestamp) AS open_price,
    max(price) AS high_price,
    min(price) AS low_price,
    last(price, timestamp) AS close_price,
    coalesce(sum(volume), 0.0) AS total_volume,
    count(*) AS tick_count
FROM price_history
GROUP BY candle_bucket, symbol, asset_id
WITH NO DATA;

-- Schedule continuous aggregate refresh policy (runs every 15 minutes, 
-- refreshing data from 3 days ago up to the last 15 minutes)
SELECT add_continuous_aggregate_policy(
    'price_history_hourly_candlestick',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes',
    if_not_exists => TRUE
);

-- ----------------------------------------------------------------------------
-- 3. CONFIGURE HYPERTABLE COMPRESSION
-- ----------------------------------------------------------------------------
-- Enable TimescaleDB hybrid columnar compression.
-- Segments chunks by asset symbol/ID and sorts by timestamp descending.
-- Typically delivers 90%+ storage reduction and faster aggregate scans.
ALTER TABLE price_history SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol, asset_id',
    timescaledb.compress_orderby = 'timestamp DESC'
);

-- Automatically compress chunks older than 7 days
SELECT add_compression_policy(
    'price_history', 
    INTERVAL '7 days', 
    if_not_exists => TRUE
);

-- ----------------------------------------------------------------------------
-- 4. CONFIGURE DATA RETENTION POLICY
-- ----------------------------------------------------------------------------
-- Automatically drop raw price chunks older than 365 days to manage disk space
-- (while keeping historical hourly candlesticks in continuous aggregates).
SELECT add_retention_policy(
    'price_history', 
    INTERVAL '365 days', 
    if_not_exists => TRUE
);

-- ----------------------------------------------------------------------------
-- 5. VERIFY HYPERTABLE CONFIGURATION
-- ----------------------------------------------------------------------------
SELECT 
    hypertable_schema,
    hypertable_name,
    owner,
    num_dimensions,
    compression_enabled
FROM timescaledb_information.hypertables
WHERE hypertable_name = 'price_history';
