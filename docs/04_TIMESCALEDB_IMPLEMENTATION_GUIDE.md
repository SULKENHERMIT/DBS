# TimescaleDB Implementation and Architecture Guide

## 1. Overview of the TimescaleDB Architecture

TimescaleDB is an open-source time-series database engineered as an extension to PostgreSQL. It provides full SQL compliance and relational integrity while introducing **Hypertables**, **Chunks**, **Continuous Aggregates**, and **Native Columnar Compression**.

```
                           PRICE_HISTORY HYPERTABLE
                     (Logical Unified Virtual Table)
                                   |
         +-------------------------+-------------------------+
         |                         |                         |
       Chunk 1                   Chunk 2                   Chunk 3
  [Day 1: 00:00-23:59]      [Day 2: 00:00-23:59]      [Day 3: 00:00-23:59]
  • Compressed Columnar     • Compressed Columnar     • Active Uncompressed
  • Read-Only Archive       • Read-Only Archive       • Fast In-Memory Writes
  • Segmented by Symbol     • Segmented by Symbol     • Local B-Tree Indexes
```

---

## 2. Deep Dive into Implementation Components

### A. Hypertables & Chunking Mechanism
A hypertable is an abstraction that acts as a single continuous table to standard SQL queries, but is automatically partitioned into physical tables called **chunks** under the hood.

- **Partitioning Dimension**: `timestamp` (`TIMESTAMP WITH TIME ZONE`).
- **Interval Configuration**: `chunk_time_interval => INTERVAL '1 day'`.
- **Primary Key Constraint Rule**: Unlike traditional PostgreSQL where `history_id UUID PRIMARY KEY` is valid, TimescaleDB enforces that any unique index or primary key on a hypertable must contain all partitioning columns. Consequently, the primary key is defined as `(history_id, timestamp)`.

```sql
SELECT create_hypertable(
    'price_history', 
    'timestamp', 
    if_not_exists => TRUE, 
    chunk_time_interval => INTERVAL '1 day'
);
```

### B. Continuous Aggregates (Pre-materialized OHLCV Candlesticks)
In financial platforms, computing real-time Candlesticks (Open, High, Low, Close, Volume) over millions of historical ticks introduces query latency. TimescaleDB **Continuous Aggregates** automatically compute and increment OHLCV views in the background:

```sql
CREATE MATERIALIZED VIEW price_history_hourly_candlestick
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
GROUP BY candle_bucket, symbol, asset_id;
```

**Key Advantages**:
- Querying `price_history_hourly_candlestick` returns instantly, reading pre-calculated aggregates rather than scanning raw ticks.
- When new ticks arrive in the newest chunk, the background policy seamlessly updates the corresponding hourly bucket.

### C. Native Columnar Compression
Financial tick data has high repetition in symbols, timestamps, and currency decimals. TimescaleDB transforms row-oriented chunk data into columnar format:
- **Segment By**: `symbol, asset_id` (data grouped by ticker).
- **Order By**: `timestamp DESC` (ticks arranged chronologically).
- **Policy**: Chunks older than 7 days are automatically compressed, achieving 90%+ storage savings without preventing SQL queries.

```sql
ALTER TABLE price_history SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol, asset_id',
    timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('price_history', INTERVAL '7 days');
```

### D. Data Lifecycle and Retention Policies
Raw ticks consume disk space. TimescaleDB automates retention by dropping chunk files atomically:
```sql
SELECT add_retention_policy('price_history', INTERVAL '365 days');
```
Because chunk deletion is an `unlink()` call at the filesystem level, it generates zero WAL overhead and causes no table lock contention.

---

## 3. Modular SQL Script Inventory

The implementation is structured into 9 modular SQL files and 1 master orchestration script:

| Script File | Purpose | Key Objects Created / Executed |
| :--- | :--- | :--- |
| `01_init_extensions.sql` | Extension Bootstrap | `uuid-ossp`, `timescaledb` |
| `02_create_tables.sql` | Relational & Time-Series DDL | All 18 tables with PKs, FKs, and check constraints |
| `03_create_hypertables.sql`| TimescaleDB Hypertables & Policies | `create_hypertable`, continuous aggregate views, compression & retention |
| `04_create_indexes.sql` | Relational & Chunk Indexes | 14 original DA-2 indexes + chunk-level compound indexes |
| `05_create_functions_and_triggers.sql` | PL/pgSQL Business Engine | 2 triggers (`update_holdings`, `audit_log`) and 7 stored functions |
| `06_seed_sample_data.sql` | Baseline DA-2 Dataset | Exact seed records for currencies, users, assets, portfolios, holdings, etc. |
| `07_seed_timeseries_extended.sql` | Synthetic Multi-Day Time-Series | Hourly tick generator spanning 14 days across all 6 platform assets |
| `08_core_timeseries_queries.sql` | Demonstration Suite | All 12 analytical queries, time-bucketing, and hypertable inspections |
| `09_verification_tests.sql`| Quality & Integrity Suite | Row count unions, portfolio valuation checks, atomic trade verification |
| `run_all.sql` | Master Orchestration Script | Executes the complete pipeline sequentially from step 1 to 9 |
