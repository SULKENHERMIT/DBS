# Grafana Visualization Integration Guide
## Live Crypto and Stock Analysis Platform (TimescaleDB Implementation)

**Course**: Database Systems (Digital Assignment – 03)  
**Slot**: `F2 + TF2`  
**Team Members**:
1. **Narendran R** (`25BDS1161`)
2. **Palaniappan R.M** (`25BDS1148`)
3. **Kayelesh P** (`25BDS1040`)

---

## 1. Quick Access & Overview

| Component | Value / Access URL |
| :--- | :--- |
| **Grafana URL** | **`http://localhost:3000`** |
| **Dashboard Path** | `Market Analytics` $\rightarrow$ **`Live Crypto and Stock Analysis Platform — TimescaleDB Analytics`** |
| **Default Login** | Username: `admin` \| Password: `admin` *(Anonymous view is also enabled)* |
| **Data Source** | `TimescaleDB Platform` (`timescale-crypto:5432`) |
| **Database Role** | `grafana_reader` *(Read-only, SELECT-only permissions)* |
| **TimescaleDB Container** | `timescale-crypto` (Port `5433` host, `5432` internal) |
| **Docker Network** | `timescale-net` (User-defined bridge with internal DNS) |

---

## 2. Architecture & Security Design

```
+-------------------------------------------------------------+
|                      WINDOWS HOST                           |
|   Web Browser -> http://localhost:3000 (Grafana UI)         |
+-------------------------------------------------------------+
                              |
+-----------------------------v-------------------------------+
|             DOCKER USER NETWORK: timescale-net              |
|                                                             |
|   [grafana-crypto]                                          |
|   Port: 3000                                                |
|   Storage: grafana-storage volume                           |
|   Provisioning: /etc/grafana/provisioning                   |
|         |                                                   |
|         | (Internal TCP 5432, Read-Only grafana_reader)     |
|         v                                                   |
|   [timescale-crypto]                                        |
|   Image: timescale/timescaledb:latest-pg16                  |
|   Database: postgres                                        |
|   Port: 5432 (Internal) -> 5433 (Host)                      |
+-------------------------------------------------------------+
```

### Security & Least Privilege Guarantee
1. **Dedicated Read-Only Account**: Created `grafana_reader` with `SELECT` permissions on `public`, `timescaledb_information`, and `_timescaledb_internal`.
2. **Mutation Guard**: `INSERT`, `UPDATE`, `DELETE`, and DDL statements are strictly blocked by PostgreSQL security policies.
3. **Shielded Database Port**: Port 5432 is not exposed publicly; communication between Grafana and TimescaleDB happens exclusively over the private internal Docker bridge network `timescale-net`.
4. **Data Integrity**: The original TimescaleDB container, its storage volumes, and all 18 tables remain 100% untouched and preserved.

---

## 3. The 12 Dashboard Panels & Executable SQL Queries

### Panel 1: Latest Stored Ticker Quotes (Market Watch)
* **Visualization Type**: `Stat` (Multi-card header)
* **SQL Query**:
  ```sql
  SELECT 
    t.updated_at AS time,
    a.symbol AS metric,
    t.price_per_unit AS value
  FROM ticker_stats t
  JOIN assets a ON t.asset_id = a.asset_id
  ORDER BY a.symbol;
  ```

### Panel 2: Historical Price Time-Series
* **Visualization Type**: `Time series`
* **SQL Query**:
  ```sql
  SELECT 
    timestamp AS time,
    price AS value,
    symbol AS metric
  FROM price_history
  WHERE (symbol IN ($asset) OR '$asset' = '$__all')
    AND $__timeFilter(timestamp)
  ORDER BY timestamp ASC;
  ```

### Panel 3: Hourly OHLCV Candlesticks (Continuous Aggregate)
* **Visualization Type**: `Candlestick`
* **SQL Query**:
  ```sql
  SELECT 
    candle_bucket AS time,
    open_price AS open,
    high_price AS high,
    low_price AS low,
    close_price AS close,
    total_volume AS volume
  FROM price_history_hourly_candlestick
  WHERE symbol = '$asset_single'
    AND $__timeFilter(candle_bucket)
  ORDER BY candle_bucket ASC;
  ```

### Panel 4: Hourly Trading Volume Over Time
* **Visualization Type**: `Time series` (Bars style)
* **SQL Query**:
  ```sql
  SELECT 
    candle_bucket AS time,
    total_volume AS value,
    symbol AS metric
  FROM price_history_hourly_candlestick
  WHERE (symbol IN ($asset) OR '$asset' = '$__all')
    AND $__timeFilter(candle_bucket)
  ORDER BY candle_bucket ASC;
  ```

### Panel 5: Daily Open, High, Low, Close (time_bucket Daily Summary)
* **Visualization Type**: `Table`
* **SQL Query**:
  ```sql
  SELECT 
    to_char(time_bucket('1 day', timestamp), 'YYYY-MM-DD') AS "Date",
    symbol AS "Asset",
    round(first(price, timestamp)::numeric, 2) AS "Open ($)",
    round(max(price)::numeric, 2) AS "High ($)",
    round(min(price)::numeric, 2) AS "Low ($)",
    round(last(price, timestamp)::numeric, 2) AS "Close ($)",
    round(sum(volume)::numeric, 0) AS "Volume ($)"
  FROM price_history
  WHERE $__timeFilter(timestamp)
  GROUP BY time_bucket('1 day', timestamp), symbol
  ORDER BY "Date" DESC, symbol ASC
  LIMIT 50;
  ```

### Panel 6: Seven-Day Asset Performance (% Return & High/Low Range)
* **Visualization Type**: `Table` (Color background for return %)
* **SQL Query**:
  ```sql
  WITH asset_range AS (
    SELECT 
      symbol,
      first(price, timestamp) AS start_price,
      last(price, timestamp) AS current_price,
      max(price) AS max_7d,
      min(price) AS min_7d
    FROM price_history
    WHERE timestamp >= (SELECT max(timestamp) - INTERVAL '7 days' FROM price_history)
    GROUP BY symbol
  )
  SELECT 
    symbol AS "Asset",
    round(start_price::numeric, 2) AS "Start ($)",
    round(current_price::numeric, 2) AS "Current ($)",
    round(((current_price - start_price) / start_price * 100.0)::numeric, 2) AS "7D Return (%)",
    round(min_7d::numeric, 2) AS "7D Low ($)",
    round(max_7d::numeric, 2) AS "7D High ($)"
  FROM asset_range
  ORDER BY "7D Return (%)" DESC;
  ```

### Panel 7: Portfolio Total Market Value
* **Visualization Type**: `Stat`
* **SQL Query**:
  ```sql
  SELECT 
    sum(market_value) AS "Total Market Value"
  FROM get_portfolio_valuation('$portfolio'::uuid);
  ```

### Panel 8: Portfolio Unrealized Profit/Loss & Return %
* **Visualization Type**: `Stat`
* **SQL Query**:
  ```sql
  SELECT 
    sum(unrealized_pnl) AS "Unrealized PnL ($)",
    round((sum(unrealized_pnl) / nullif(sum(cost_basis), 0) * 100.0)::numeric, 2) AS "Return (%)"
  FROM get_portfolio_valuation('$portfolio'::uuid);
  ```

### Panel 9: Portfolio Asset Holdings Breakdown
* **Visualization Type**: `Table`
* **SQL Query**:
  ```sql
  SELECT 
    symbol AS "Symbol",
    name AS "Asset Name",
    type AS "Type",
    round(quantity::numeric, 4) AS "Quantity",
    round(average_buy_price::numeric, 2) AS "Avg Buy Price ($)",
    round(current_price::numeric, 2) AS "Current Price ($)",
    round(cost_basis::numeric, 2) AS "Cost Basis ($)",
    round(market_value::numeric, 2) AS "Market Value ($)",
    round(unrealized_pnl::numeric, 2) AS "PnL ($)",
    round(unrealized_pnl_pct::numeric, 2) AS "PnL (%)"
  FROM get_portfolio_valuation('$portfolio'::uuid)
  ORDER BY "Market Value ($)" DESC;
  ```

### Panel 10: Price Alerts & Notification Dispatch Status
* **Visualization Type**: `Table`
* **SQL Query**:
  ```sql
  SELECT 
    a.symbol AS "Symbol",
    round(a.threshold::numeric, 2) AS "Threshold ($)",
    a.direction AS "Direction",
    CASE WHEN a.enabled THEN 'Active' ELSE 'Triggered' END AS "Alert State",
    coalesce(n.channel, 'N/A') AS "Channel",
    coalesce(n.status, 'PENDING') AS "Dispatch Status",
    to_char(coalesce(n.sent_at, a.triggered_at), 'YYYY-MM-DD HH24:MI') AS "Event Time"
  FROM alerts a
  LEFT JOIN notifications n ON a.alert_id = n.alert_id
  ORDER BY a.created_at DESC;
  ```

### Panel 11: TimescaleDB Hypertable Chunks & Partitioning
* **Visualization Type**: `Table`
* **SQL Query**:
  ```sql
  SELECT 
    chunk_name AS "Chunk Name",
    to_char(range_start, 'YYYY-MM-DD HH24:MI') AS "Start Range",
    to_char(range_end, 'YYYY-MM-DD HH24:MI') AS "End Range",
    CASE WHEN is_compressed THEN 'Columnar Compressed' ELSE 'Raw Uncompressed' END AS "Compression State"
  FROM timescaledb_information.chunks
  WHERE hypertable_name = 'price_history'
  ORDER BY range_start DESC
  LIMIT 20;
  ```

### Panel 12: Columnar Compression & Storage Space Savings
* **Visualization Type**: `Stat`
* **SQL Query**:
  ```sql
  SELECT 
    round((1.0 - (after_compression_total_bytes::numeric / nullif(before_compression_total_bytes, 0))) * 100.0, 2) AS "Space Saved (%)",
    pg_size_pretty(before_compression_total_bytes) AS "Uncompressed Size",
    pg_size_pretty(after_compression_total_bytes) AS "Compressed Size",
    number_compressed_chunks AS "Compressed Chunks",
    total_chunks AS "Total Chunks"
  FROM hypertable_compression_stats('price_history');
  ```

---

## 4. Screenshot Checklist for Assignment Report Submission

| Screenshot No. | Section | Target Object / View in Grafana | Description to Write in Assignment |
| :---: | :--- | :--- | :--- |
| **GRAF-01** | Data Source | `Administration` $\rightarrow$ `Data sources` $\rightarrow$ `TimescaleDB Platform` | Proof of valid PostgreSQL connection with TimescaleDB enabled (`Database Connection OK`). |
| **GRAF-02** | Dashboard Header | Panel 1 (`Latest Stored Ticker Quotes`) | Grid of current prices for BTC, ETH, SOL, AAPL, NVDA, TSLA with time picker set to Last 14 Days. |
| **GRAF-03** | Time-Series | Panel 2 (`Historical Price Time-Series`) | Multi-line comparative price graph with dropdown selector for comparison assets. |
| **GRAF-04** | Financial Chart | Panel 3 (`Hourly OHLCV Candlesticks`) | Candlestick chart showing Open, High, Low, Close bars pre-materialized from TimescaleDB continuous aggregate. |
| **GRAF-05** | Volume Analysis| Panel 4 (`Hourly Trading Volume Over Time`) | Bar chart displaying trading volume over 14 days grouped by time buckets. |
| **GRAF-06** | Daily Rollup | Panel 5 (`Daily Open, High, Low, Close`) | Tabular rollup demonstrating `time_bucket('1 day', timestamp)`, `first()` and `last()`. |
| **GRAF-07** | Performance | Panel 6 (`Seven-Day Asset Performance`) | Ranked return percentages showing winners and losers over a 7-day rolling window. |
| **GRAF-08** | Valuation | Panels 7 & 8 (`Portfolio Market Value & PnL`) | Live valuation stat cards matching the DA-2 reference portfolio values ($131,347.50 / $134,677.50). |
| **GRAF-09** | Asset Positions| Panel 9 (`Portfolio Asset Holdings Breakdown`) | Complete table of holdings showing quantities, purchase prices, current prices, and unrealized return. |
| **GRAF-10** | Triggers & Logs| Panel 10 (`Price Alerts & Notification Dispatch`) | Operational table displaying user price alerts and notification channels. |
| **GRAF-11** | Chunks View | Panel 11 (`TimescaleDB Hypertable Chunks`) | Physical partition chunks table showing 1-day time ranges and compression states. |
| **GRAF-12** | Compression | Panel 12 (`Columnar Compression Storage Savings`)| Stat metrics proving over 59% space reduction on historical chunks older than 7 days. |

---

## 5. How Grafana Visualizes TimescaleDB Data (Viva Explanation)

1. **Native SQL Query Execution**:
   - Grafana communicates with TimescaleDB via standard PostgreSQL TCP protocol (Port `5432`).
   - Queries return tabular rows that Grafana maps to time series or categorical fields.
2. **Dynamic Time Filtering (`$__timeFilter()`)**:
   - When the user changes the time picker (e.g., *Last 7 days*), Grafana dynamically injects `timestamp BETWEEN '...' AND '...'` into the SQL query before execution.
3. **TimescaleDB Optimization**:
   - Because `price_history` is a hypertable, queries with `$__timeFilter(timestamp)` perform **Chunk Exclusion / Pruning** in TimescaleDB: the query engine scans only the chunks covering the selected time window, skipping all others.
   - For candlestick charts, queries hit the **Continuous Aggregate View** (`price_history_hourly_candlestick`), which reads pre-aggregated bars instead of raw tick points, delivering sub-10ms response times even across millions of rows.
