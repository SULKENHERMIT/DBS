# DA-3 Presentation & Faculty Defense Guide
## Live Crypto and Stock Analysis Platform (TimescaleDB Implementation)

**Course**: Database Systems (Digital Assignment – 03)  
**Slot**: `F2 + TF2`  
**Team Members**:
1. **Narendran R** (`25BDS1161`)
2. **Palaniappan R.M** (`25BDS1148`)
3. **Kayelesh P** (`25BDS1040`)

---

## 1. Quick 60-Second Elevator Pitch (Start with this)

> *"Good morning/afternoon, Ma'am. In Digital Assignment 02 (DA-2), we designed a relational database system for a Live Crypto and Stock Analysis Platform with 18 normalized tables, 14 indexes, and 9 PL/pgSQL triggers.*
>
> *However, financial markets generate millions of high-frequency price ticks. In standard PostgreSQL, appending millions of time-series rows causes B-tree indexes to bloat beyond RAM capacity, degrading insert throughput and slowing analytical queries.*
>
> *For DA-3, we extended our architecture using **TimescaleDB**. We converted `price_history` into a **hypertable partitioned by 1-day time chunks**, implemented **automated continuous aggregates for hourly OHLCV candlesticks**, enabled **columnar compression yielding over 59% storage savings**, and validated atomic trade execution and portfolio valuation with 100% exactness to DA-2."*

---

## 2. The Core Technical Concept: Why TimescaleDB?

When Ma'am asks: **"What is the difference between your DA-2 and DA-3?"**

| Feature | DA-2 (Standard PostgreSQL) | DA-3 (TimescaleDB Extension) |
| :--- | :--- | :--- |
| **Table Structure** | Traditional flat table for `price_history`. | **Hypertable** — logically one table, physically divided into time chunks. |
| **Data Partitioning** | None (single monolithic table file on disk). | **Automatic 1-day partition chunks** localized in RAM. |
| **Candlestick Calculation** | Computed on-the-fly from millions of rows every query. | **Pre-materialized Continuous Aggregate View** (`price_history_hourly_candlestick`). |
| **Storage Optimization** | Standard row-based tuple storage (heavy disk footprint). | **Hybrid Columnar Compression** (>59% to 90% disk reduction). |
| **Time Analysis** | Complex `DATE_TRUNC()` with window functions. | Native **`time_bucket()`**, **`first()`**, and **`last()`** analytical functions. |
| **DA-2 Preservation** | All 18 tables, triggers, and sample data. | **100% Preserved** — zero disruption to relational schema or ACID transactions. |

---

## 3. Step-by-Step Walkthrough of What You Executed

Explain your workflow logically in these 4 stages:

### Stage 1: Containerized Database Architecture
- Ran the official TimescaleDB container (`timescale/timescaledb:latest-pg16`) via Docker.
- Mapped the external host port to **`5433`** to avoid port collisions with any local PostgreSQL instance.
- Mounted the local `sql/` directory directly into `/sql` inside the container for seamless execution.

### Stage 2: Database Initialization (`01` to `05`)
1. **Extensions (`01_init_extensions.sql`)**: Enabled `uuid-ossp` (for UUID primary keys) and `timescaledb`.
2. **Tables (`02_create_tables.sql`)**: Created all **18 tables** (users, portfolios, holdings, assets, exchanges, transactions, price_history, news, alerts, audit logs).
3. **Hypertable & Policies (`03_create_hypertables.sql`)**:
   - Transformed `price_history` via `create_hypertable('price_history', 'timestamp', chunk_time_interval => INTERVAL '1 day')`.
   - Created the materialized continuous aggregate `price_history_hourly_candlestick`.
   - Attached an automatic compression policy for chunks older than 7 days.
4. **Indexes (`04_create_indexes.sql`)**: Created 14 composite B-tree and local chunk indexes.
5. **Stored Procedures & Triggers (`05_create_functions_and_triggers.sql`)**: 
   - `trg_log_transaction_activity`: Synchronous audit logging upon every trade.
   - `record_transaction_and_update_holding()`: Atomic trade coordinator (updates cash, adjusts weighted-average cost basis, writes audit logs).
   - `get_portfolio_valuation()`: Real-time table-valued portfolio valuation engine.

### Stage 3: Baseline & Extended Time-Series Seeding (`06` & `07`)
1. **Baseline Seeding (`06_seed_sample_data.sql`)**: Exact baseline entities and portfolios from DA-2.
2. **Extended Seeding (`07_seed_timeseries_extended.sql`)**: Synthesized **2,016 hourly observations across 14 trading days** to stress-test TimescaleDB partitioning and chunk creation.

### Stage 4: Execution & Verification (`08` & `09`)
- Executed master script `run_all.sql`.
- Verified table row counts (all 18 tables populated).
- Validated chunk compression (7 compressed chunks, 59.8% savings).
- Executed portfolio valuation query.

---

## 4. Explaining the Output in Your Screenshot

When pointing to your terminal screenshot:

```
              holding_id              | symbol |     name     |  type  |  quantity   | average_buy_price | current_price |      cost_basis      |     market_value     |   unrealized_pnl    | unrealized_pnl_pct 
--------------------------------------+--------+--------------+--------+-------------+-------------------+---------------+----------------------+----------------------+---------------------+--------------------
 33333333-3333-3333-3333-333333333331 | BTC    | Bitcoin Core | crypto |  1.25000000 |      58200.000000 |  64850.250000 | 72750.00000000000000 | 81062.81250000000000 | 8312.81250000000000 |            11.4265 
 33333333-3333-3333-3333-333333333332 | ETH    | Ethereum     | crypto |  8.50000000 |       3100.000000 |   3450.000000 | 26350.00000000000000 | 29325.00000000000000 | 2975.00000000000000 |            11.2903 
 33333333-3333-3333-3333-333333333333 | AAPL   | Apple Inc.   | stock  | 70.00000000 |        214.285714 |    228.750000 | 14999.99998000000000 | 16012.50000000000000 | 1012.50002000000000 |             6.7500 
 33333333-3333-3333-3333-333333333334 | NVDA   | NVIDIA Corp  | stock  | 70.00000000 |        105.500000 |    124.500000 |  7385.00000000000000 |  8715.00000000000000 | 1330.00000000000000 |            18.0095 
```

**Key Points to Tell Faculty:**
1. **Source of Truth**: This is the output of the stored function `get_portfolio_valuation('11111111-1111-1111-1111-111111111111')` for user portfolio *"Growth & Multi-Asset Fund"*.
2. **Formula Applied by Engine**:
   - $\text{Cost Basis} = \text{Quantity} \times \text{Average Buy Price}$
   - $\text{Market Value} = \text{Quantity} \times \text{Current Price (from live ticker cache)}$
   - $\text{Unrealized PnL} = \text{Market Value} - \text{Cost Basis}$
   - $\text{PnL \%} = \frac{\text{Unrealized PnL}}{\text{Cost Basis}} \times 100$
3. **Atomic Trade Verification**:
   - NVDA quantity was originally 80 shares @ \$105.50.
   - During verification test TC-05, our atomic trade coordinator executed a SELL transaction of 10 shares @ \$126.00.
   - The screenshot proves that the holdings table dynamically updated to **70 shares**, preserving the weighted-average cost basis of \$105.50 and computing the correct revised profit of **+$1,330.00 (+18.0095%)**.

---

## 5. Potential Faculty Viva Questions & Answers

### Q1: "Why did you use a hypertable instead of regular PostgreSQL table partitioning?"
> **Answer**:  
> *"Regular PostgreSQL table partitioning requires manual `CREATE TABLE ... PARTITION OF` for every date range, or third-party pg_partman scripts.  
> TimescaleDB hypertables partition automatically on timestamp insert into contiguous time chunks. Furthermore, hypertables support continuous aggregate rollups and columnar compression policies, which native PostgreSQL partitions cannot do."*

---

### Q2: "What is a chunk interval, and why did you choose 1 day?"
> **Answer**:  
> *"A chunk interval is the time span each physical sub-table covers. We chose 1 day (`INTERVAL '1 day'`) because crypto and equity markets operate on daily cycles. One day's worth of tick data fits easily inside database memory (RAM), ensuring that recent inserts and queries hit cache rather than doing expensive disk I/O."*

---

### Q3: "What is a continuous aggregate and how does it differ from a PostgreSQL materialized view?"
> **Answer**:  
> *"A standard PostgreSQL materialized view has to be completely refreshed from scratch (`REFRESH MATERIALIZED VIEW`), which locks the table and re-reads all history.  
> A TimescaleDB continuous aggregate is incremental: it only processes newly inserted chunks since the last refresh offset, making real-time candlestick rendering fast and lightweight."*

---

### Q4: "How does TimescaleDB achieve 60% to 90% compression?"
> **Answer**:  
> *"Standard PostgreSQL stores data as row-oriented tuples. TimescaleDB columnar compression transforms old chunks into columns, grouping rows by `symbol` and `asset_id` and sorting by `timestamp`. It applies specialized compression algorithms: delta-of-delta for timestamps, XOR (Gorilla) for floating-point prices, and run-length encoding for repeated symbols."*

---

### Q5: "Did you change your DA-2 ER diagram or tables?"
> **Answer**:  
> *"No, Ma'am. All 18 normalized tables from DA-2 (3NF compliant) are 100% preserved. The only schema enhancement was making `price_history`'s primary key composite `(history_id, timestamp)` so that TimescaleDB can partition along the time axis."*

---

## 6. Commands to Demonstrate Live If Asked

If Ma'am says: *"Show me the database right now."*

1. **Open terminal**:
   ```powershell
   docker exec -it -w /sql timescale-crypto psql -U postgres
   ```
2. **Show the 18 Tables**:
   ```sql
   \dt
   ```
3. **Show the Hypertables & Chunks**:
   ```sql
   SELECT hypertable_name, num_chunks, compression_enabled FROM timescaledb_information.hypertables;
   SELECT * FROM hypertable_compression_stats('price_history');
   ```
4. **Show Real-time Candlesticks**:
   ```sql
   SELECT candle_bucket, symbol, open_price, high_price, low_price, close_price, total_volume 
   FROM price_history_hourly_candlestick 
   ORDER BY candle_bucket DESC LIMIT 6;
   ```
5. **Show Live Portfolio Valuation (Matches Screenshot)**:
   ```sql
   SELECT symbol, name, quantity, average_buy_price, current_price, market_value, unrealized_pnl, unrealized_pnl_pct 
   FROM get_portfolio_valuation('11111111-1111-1111-1111-111111111111');
   ```
