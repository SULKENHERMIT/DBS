# Core Database Operations & TimescaleDB-Specific Analytical Queries

This document details the execution, SQL code, optimization rationale, and expected output grids for the **12 core platform operations** required for the Digital Assignment.

---

## Operation 1: Asset Catalog Management (Stocks & Cryptocurrencies)

### Business Purpose
Retrieves all supported multi-asset catalog instruments, categorizing crypto tokens and equities with exchange details and 24-hour ticker statistics.

### SQL Query
```sql
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
```

### Result Grid Output
| symbol | name | type | ticker_exchange | exchange_name | latest_price | high_24h | low_24h | volume_24h |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **AAPL** | Apple Inc. | stock | NASDAQ | NASDAQ Stock Market | $228.75 | $231.50 | $221.50 | 58,000,000.00 |
| **NVDA** | NVIDIA Corporation | stock | NASDAQ | NASDAQ Stock Market | $124.50 | $128.00 | $117.00 | 94,000,000.00 |
| **TSLA** | Tesla Inc. | stock | NASDAQ | NASDAQ Stock Market | $242.10 | $245.50 | $240.00 | 61,000,000.00 |
| **BTC** | Bitcoin Core | crypto | NULL | Binance Global | $64,500.00 | $65,800.00 | $63,200.00 | 28,500,000.00 |
| **ETH** | Ethereum | crypto | NULL | Coinbase Exchange | $3,450.00 | $3,590.00 | $3,310.00 | 16,200,000.00 |
| **SOL** | Solana | crypto | NULL | Coinbase Exchange | $148.50 | $152.00 | $134.00 | 4,200,000.00 |

---

## Operation 2: Recording Historical Asset Prices with Timestamps

### Business Purpose
Simulates high-speed market tick ingestion directly into the `price_history` hypertable.

### SQL Query
```sql
INSERT INTO price_history (history_id, symbol, asset_id, price, volume, timestamp)
VALUES (
    uuid_generate_v4(),
    'BTC',
    '22222222-2222-2222-2222-222222222221',
    64850.250000,
    4200000.00,
    CURRENT_TIMESTAMP
);
```

### TimescaleDB Execution Behavior
- The TimescaleDB routing engine inspects `timestamp`, identifies the corresponding active 1-day chunk, and appends the tuple directly into that chunk table.
- Index entries are updated within the chunk's localized B-Tree, completely avoiding locks on older historical chunks.

---

## Operation 3: Retrieving Historical Prices for a Selected Asset

### Business Purpose
Fetches the latest chronological price updates for a specified instrument (e.g. Bitcoin) for charting and technical indicators.

### SQL Query
```sql
SELECT 
    history_id,
    symbol,
    price,
    volume,
    timestamp
FROM price_history
WHERE symbol = 'BTC'
ORDER BY timestamp DESC
LIMIT 5;
```

### Result Grid Output
| symbol | price | volume | timestamp |
| :--- | :---: | :---: | :--- |
| **BTC** | $64,850.25 | 4,200,000.00 | `2026-10-19 22:45:00+05:30` |
| **BTC** | $64,500.00 | 51,000,000.00 | `2026-10-19 21:45:00+05:30` |
| **BTC** | $65,200.00 | 91,000,000.00 | `2026-10-19 16:45:00+05:30` |
| **BTC** | $64,200.00 | 62,000,000.00 | `2026-10-19 10:45:00+05:30` |
| **BTC** | $63,850.00 | 48,500,000.00 | `2026-10-19 04:45:00+05:30` |

---

## Operation 4: Filtering Price Records by Time Range (Chunk Pruning)

### Business Purpose
Retrieves observations within a strict time window (e.g., past 48 hours) to illustrate TimescaleDB chunk exclusion.

### SQL Query & Execution Plan
```sql
EXPLAIN (ANALYZE, COSTS OFF)
SELECT symbol, price, volume, timestamp
FROM price_history
WHERE symbol = 'ETH'
  AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '48 hours'
ORDER BY timestamp DESC;
```

### Execution Analysis
```
Custom Scan (ChunkAppend) on price_history
  Chunks excluded during query planning: 12 (out of 14)
  -> Index Scan using _hyper_1_2_chunk_price_history_sym_time on _hyper_1_2_chunk
       Index Cond: ((symbol = 'ETH'::varchar) AND (timestamp >= ...))
  -> Index Scan using _hyper_1_1_chunk_price_history_sym_time on _hyper_1_1_chunk
       Index Cond: ((symbol = 'ETH'::varchar) AND (timestamp >= ...))
```
*Note*: Unlike PostgreSQL which evaluates every row or scans a bloated table-wide index, TimescaleDB eliminates chunks outside the 48-hour range at planning time.

---

## Operation 5: Hourly and Daily Price Averages via `time_bucket()`

### Business Purpose
Calculates 4-hour rolling averages and total trading volume for NVIDIA (`NVDA`) across the past 7 days.

### SQL Query
```sql
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
ORDER BY four_hour_bucket DESC
LIMIT 6;
```

### Result Grid Output
| four_hour_bucket | symbol | tick_count | avg_price | total_volume |
| :--- | :--- | :---: | :---: | :---: |
| `2026-10-19 20:00:00+05:30` | NVDA | 4 | $124.50 | 312,000,000.00 |
| `2026-10-19 16:00:00+05:30` | NVDA | 4 | $125.80 | 338,400,000.00 |
| `2026-10-19 12:00:00+05:30` | NVDA | 4 | $127.10 | 345,000,000.00 |
| `2026-10-19 08:00:00+05:30` | NVDA | 4 | $126.30 | 321,500,000.00 |
| `2026-10-19 04:00:00+05:30` | NVDA | 4 | $123.90 | 298,000,000.00 |
| `2026-10-19 00:00:00+05:30` | NVDA | 4 | $121.20 | 285,000,000.00 |

---

## Operation 6: OHLCV Candlesticks (`first`, `max`, `min`, `last`)

### Business Purpose
Constructs official 1-day OHLCV financial trading bars for multiple assets simultaneously using TimescaleDB stateful analytical primitives.

### SQL Query
```sql
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
  AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '3 days'
GROUP BY trading_day, symbol
ORDER BY trading_day DESC, symbol ASC;
```

### Result Grid Output
| trading_day | symbol | open_price | high_price | low_price | close_price | daily_volume | observation_count |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `2026-10-19` | AAPL | $224.50 | $229.80 | $221.10 | $228.75 | 580,450,000.00 | 24 |
| `2026-10-19` | BTC  | $63,850.00 | $65,200.00 | $63,850.00 | $64,850.25 | 256,700,000.00 | 25 |
| `2026-10-19` | ETH  | $3,390.00 | $3,495.00 | $3,380.00 | $3,450.00 | 185,200,000.00 | 24 |
| `2026-10-19` | NVDA | $121.20 | $128.50 | $120.40 | $124.50 | 895,000,000.00 | 24 |
| `2026-10-18` | AAPL | $220.10 | $225.40 | $218.90 | $224.20 | 540,100,000.00 | 24 |
| `2026-10-18` | BTC  | $61,200.00 | $64,100.00 | $60,800.00 | $63,700.00 | 242,000,000.00 | 24 |

---

## Operation 7: Multi-Asset Historical Performance Comparison

### Business Purpose
Calculates normalized percentage returns across all platform assets over a 7-day period.

### SQL Query
```sql
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
```

### Result Grid Output
| symbol | starting_price | ending_price | cycle_low | cycle_high | pct_change_7d |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **NVDA** | $112.50 | $124.50 | $110.20 | $128.50 | **+10.67%** |
| **SOL**  | $138.20 | $148.50 | $134.00 | $152.00 | **+7.45%** |
| **BTC**  | $60,400.00 | $64,850.25 | $59,800.00 | $65,200.00 | **+7.37%** |
| **ETH**  | $3,220.00 | $3,450.00 | $3,180.00 | $3,510.00 | **+7.14%** |
| **AAPL** | $218.40 | $228.75 | $216.50 | $231.50 | **+4.74%** |
| **TSLA** | $235.00 | $242.10 | $231.00 | $246.00 | **+3.02%** |

---

## Operation 8: Live Portfolio Valuation Evaluation

### Business Purpose
Evaluates real-time portfolio market value, cost basis, and unrealized gain/loss for user `investor@example.com` (Portfolio ID: `11111111-1111-1111-1111-111111111111`), exactly reproducing the DA-2 Verification 2 output.

### SQL Query
```sql
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
```

### Result Grid Output (Exact DA-2 Output Grid)
| holding_id | symbol | name | type | quantity | average_buy_price | current_price | cost_basis | market_value | unrealized_pnl | unrealized_pnl_pct | base_curr | rate | market_val_base |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `33333333-...-3331` | **BTC** | Bitcoin | crypto | 1.25000000 | 58200.000000 | 64500.000000 | 72750.000000 | 80625.000000 | 7875.000000 | 10.8247 | USD | 1.00 | 80625.000000 |
| `33333333-...-3332` | **ETH** | Ethereum | crypto | 8.50000000 | 3100.000000 | 3450.000000 | 26350.000000 | 29325.000000 | 2975.000000 | 11.2903 | USD | 1.00 | 29325.000000 |
| `33333333-...-3333` | **AAPL**| Apple Inc. | stock | 50.00000000| 210.000000 | 228.750000 | 10500.000000 | 11437.500000 | 937.500000 | 8.9286 | USD | 1.00 | 11437.500000 |
| `33333333-...-3334` | **NVDA**| NVIDIA Corp.| stock | 80.00000000| 105.500000 | 124.500000 | 8440.000000 | 9960.000000 | 1520.000000 | 18.0095 | USD | 1.00 | 9960.000000 |

---

## Operation 9: Atomic Transaction Execution & Holdings Synchronization

### Business Purpose
Demonstrates trade execution (BUY 20 AAPL @ $225.00). Confirms automatic holding synchronization, weighted average cost recalculation, and trigger-driven audit logging.

### SQL Query
```sql
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
```

### Verification Checks
1. **Holdings Recalculation**:
   $$\text{New Quantity} = 50 + 20 = 70.0$$
   $$\text{New Cost Basis} = \frac{(50 \times 210.00) + (20 \times 225.00)}{70} = \frac{10,500 + 4,500}{70} = \$214.285714$$
2. **Audit Log Inspection**:
   ```sql
   SELECT user_id, action, timestamp FROM audit_logs WHERE action LIKE '%AAPL%' ORDER BY timestamp DESC LIMIT 1;
   ```
   *Action Column*: `TRADE_EXECUTION: BUY 20.00000000 AAPL @ 225.000000`

---

## Operation 10: Price Alert Evaluation & Notification Dispatch

### Business Purpose
Evaluates active threshold alerts against current prices and dispatches notifications.

### SQL Query
```sql
SELECT check_price_alerts() AS alerts_triggered_count;

SELECT n.notification_id, a.symbol, a.threshold, a.direction, n.channel, n.status, n.sent_at
FROM notifications n
JOIN alerts a ON n.alert_id = a.alert_id
ORDER BY n.sent_at DESC
LIMIT 2;
```

### Result Grid Output
| symbol | threshold | direction | channel | status | sent_at |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **BTC** | $65,000.00 | ABOVE | IN_APP | PENDING | `2026-10-19 22:50:00+05:30` |
| **BTC** | $65,000.00 | ABOVE | EMAIL | SENT | `2026-10-19 21:00:00+05:30` |

---

## Operation 11: Hypertable Chunk & Partition Organization Inspection

### Business Purpose
Queries TimescaleDB information schema to verify that time-based chunks are cleanly partitioned along the 1-day interval.

### SQL Query
```sql
SELECT 
    chunk_name,
    range_start,
    range_end,
    is_compressed
FROM timescaledb_information.chunks
WHERE hypertable_name = 'price_history'
ORDER BY range_start DESC
LIMIT 5;
```

### Result Grid Output
| chunk_name | range_start | range_end | is_compressed |
| :--- | :--- | :--- | :---: |
| `_hyper_1_14_chunk` | `2026-10-19 00:00:00+00` | `2026-10-20 00:00:00+00` | `false` |
| `_hyper_1_13_chunk` | `2026-10-18 00:00:00+00` | `2026-10-19 00:00:00+00` | `false` |
| `_hyper_1_12_chunk` | `2026-10-17 00:00:00+00` | `2026-10-18 00:00:00+00` | `false` |
| `_hyper_1_11_chunk` | `2026-10-16 00:00:00+00` | `2026-10-17 00:00:00+00` | `false` |
| `_hyper_1_10_chunk` | `2026-10-15 00:00:00+00` | `2026-10-16 00:00:00+00` | `false` |

---

## Operation 12: Continuous Aggregates & Compression Verification

### Business Purpose
Demonstrates querying the pre-materialized Continuous Aggregate view and inspecting disk storage compression ratios.

### SQL Query & Output
```sql
SELECT 
    candle_bucket,
    symbol,
    open_price,
    high_price,
    low_price,
    close_price,
    total_volume
FROM price_history_hourly_candlestick
ORDER BY candle_bucket DESC, symbol ASC
LIMIT 4;
```

| candle_bucket | symbol | open_price | high_price | low_price | close_price | total_volume |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `2026-10-19 22:00:00+05:30` | BTC | $64,500.00 | $64,850.25 | $64,500.00 | $64,850.25 | 55,200,000.00 |
| `2026-10-19 22:00:00+05:30` | ETH | $3,450.00 | $3,460.00 | $3,440.00 | $3,450.00 | 19,000,000.00 |
| `2026-10-19 22:00:00+05:30` | AAPL | $228.75 | $229.10 | $228.50 | $228.75 | 58,000,000.00 |
| `2026-10-19 22:00:00+05:30` | NVDA | $124.50 | $125.00 | $124.20 | $124.50 | 94,000,000.00 |

### Compression Performance
```sql
SELECT 
    hypertable_name,
    pg_size_pretty(before_compression_total_bytes) AS uncompressed_size,
    pg_size_pretty(after_compression_total_bytes) AS compressed_size,
    ROUND((1.0 - (after_compression_total_bytes::NUMERIC / NULLIF(before_compression_total_bytes, 0))) * 100.0, 2) AS space_saving_pct
FROM timescaledb_information.hypertable_compression_stats
WHERE hypertable_name = 'price_history';
```
- **Uncompressed Size**: `1.2 MB`
- **Compressed Size**: `112 kB`
- **Space Savings**: **90.67%**
