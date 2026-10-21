# Step-by-Step Execution Instructions & Screenshot Documentation Checklist

## 1. Step-by-Step Execution Instructions

The SQL scripts in this repository are designed to run in **pgAdmin 4 Query Tool**, **DBeaver**, **DataGrip**, or the **psql CLI**.

### Option A: Local Docker Deployment (Recommended for Instant Setup)
If running on a development machine with Docker, pull and start the official TimescaleDB container:

```bash
# 1. Start TimescaleDB Container (PostgreSQL 16 with TimescaleDB pre-installed)
docker run -d --name timescale-crypto-db \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=crypto_stock_platform \
  timescale/timescaledb:latest-pg16

# 2. Verify Container is Running
docker ps --filter "name=timescale-crypto-db"

# 3. Execute Master SQL Script via psql inside the container
docker exec -i timescale-crypto-db psql -U postgres -d crypto_stock_platform < e:/palani\ da3/sql/run_all.sql
```

---

### Option B: Local PostgreSQL Server Installation
If using a locally installed PostgreSQL server with the TimescaleDB extension installed:

1. Open **pgAdmin 4** or your preferred SQL IDE.
2. Connect to your PostgreSQL server and create a new database:
   ```sql
   CREATE DATABASE crypto_stock_platform;
   ```
3. Open the **Query Tool** on `crypto_stock_platform`.
4. Open and execute the scripts in the following exact sequence:
   - `01_init_extensions.sql`
   - `02_create_tables.sql`
   - `03_create_hypertables.sql`
   - `04_create_indexes.sql`
   - `05_create_functions_and_triggers.sql`
   - `06_seed_sample_data.sql`
   - `07_seed_timeseries_extended.sql`
   - `08_core_timeseries_queries.sql`
   - `09_verification_tests.sql`
   *(Or execute `run_all.sql` to run the entire pipeline automatically).*

---

## 2. Screenshot Checklist for Assignment Documentation

This checklist mirrors and extends the format established in Digital Assignment 02 (DA-2) so that team members can capture standardized screenshots for the final assignment submission.

| Screenshot No. | Category | Target Object / Operation | Command / Query to Execute in Query Tool | Expected Visual Output in Result Grid |
| :---: | :--- | :--- | :--- | :--- |
| **SS-01** | Extensions | Extension Initialization | `\i 01_init_extensions.sql`<br>`SELECT extname, extversion FROM pg_extension;` | Grid showing active `uuid-ossp` and `timescaledb` extensions. |
| **SS-02** | DDL (1–6) | Core Relational Tables | `\i 02_create_tables.sql` (Tables 1 to 6) | `CREATE TABLE` completion notices for currency, users, exchanges, assets, ticker_stats, portfolios. |
| **SS-03** | DDL (7–12)| Transactional Tables | `\i 02_create_tables.sql` (Tables 7 to 12) | `CREATE TABLE` completion for holdings, transactions, performance, watchlists, items, alerts. |
| **SS-04** | DDL (13–18)| Timeseries & Audit Tables | `\i 02_create_tables.sql` (Tables 13 to 18) | `CREATE TABLE` completion for notifications, price_history, news, cache, audit_logs. |
| **SS-05** | Hypertables | Hypertable Creation & Policies | `\i 03_create_hypertables.sql`<br>`SELECT * FROM timescaledb_information.hypertables;` | Confirmation of `create_hypertable` on `price_history`, continuous aggregate view, and compression. |
| **SS-06** | Indexes | Relational & Chunk Indexes | `\i 04_create_indexes.sql` | 14 performance indexes created, including local chunk indexes on `price_history`. |
| **SS-07** | Triggers | Holdings & Audit Triggers | `\i 05_create_functions_and_triggers.sql` (Section 1–2) | Creation of `trg_update_holdings_timestamp` and `trg_log_transaction_activity`. |
| **SS-08** | Stored Func | Upsert Holding Routine | `\i 05_create_functions_and_triggers.sql` (Section 3) | Creation of weighted-average cost `upsert_holding()` function. |
| **SS-09** | Stored Func | Atomic Trade Execution | `\i 05_create_functions_and_triggers.sql` (Section 4) | Creation of `record_transaction_and_update_holding()` coordinator function. |
| **SS-10** | Stored Func | Price Alert Dispatcher | `\i 05_create_functions_and_triggers.sql` (Section 5) | Creation of `check_price_alerts()` alert evaluation engine. |
| **SS-11** | Stored Func | Portfolio Valuation Engine | `\i 05_create_functions_and_triggers.sql` (Section 6) | Creation of table-valued `get_portfolio_valuation()` function. |
| **SS-12** | Stored Func | Cache & Ticker Routines | `\i 05_create_functions_and_triggers.sql` (Section 7–9) | Creation of `record_portfolio_snapshot`, `expire_price_cache`, and `refresh_ticker_stats`. |
| **SS-13** | Seed Data | Baseline Relational Seed | `\i 06_seed_sample_data.sql` (Records 1 to 13) | `INSERT` statements executing for currencies, users, exchanges, assets, portfolios, holdings, alerts. |
| **SS-14** | Seed Data | Baseline Timeseries Seed | `\i 06_seed_sample_data.sql` (Records 14 to 18) | `INSERT` statements executing for price_history, news, cache, and audit logs. |
| **SS-15** | Seed Data | Extended Multi-Day Dataset | `\i 07_seed_timeseries_extended.sql` | Generation of 2,016 hourly observations across 14 days and continuous aggregate refresh. |
| **SS-16** | Core Query | Time Bucket Aggregations | `SELECT * FROM 08_core_timeseries_queries.sql` (Op 5) | Hourly rolling averages and volume for NVDA using `time_bucket('4 hours', timestamp)`. |
| **SS-17** | Core Query | Financial Candlesticks | `SELECT * FROM 08_core_timeseries_queries.sql` (Op 6) | 1-day OHLCV Candlesticks using `first()`, `max()`, `min()`, `last()`. |
| **SS-18** | Verification 1| Table Row Counts Union | `\i 09_verification_tests.sql` (Test TC-01) | Grid with row counts for all 18 tables matching expected baseline and extended counts. |
| **SS-19** | Verification 2| Live Portfolio Valuation | `SELECT * FROM get_portfolio_valuation('11111111-1111-1111-1111-111111111111');` | Output grid with BTC, ETH, AAPL, NVDA cost basis, market value, unrealized P/L ($131,347.50). |
| **SS-20** | Timescale DB | Chunk & Compression Stats | `SELECT * FROM timescaledb_information.chunks;` | Information schema showing 14 time-based chunks with start/end timestamps and compression metrics. |
