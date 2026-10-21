# Database Schema and Model Design for TimescaleDB

## 1. Architectural Overview & Hybrid Relational / Time-Series Strategy

The **Live Crypto and Stock Analysis Platform** requires a hybrid database architecture that balances strict relational ACID guarantees for financial accounting with ultra-high-throughput time-series ingestion and analytical aggregation.

```
+----------------------------------------------------------------------------------+
|                            PLATFORM ARCHITECTURE                                 |
+----------------------------------------------------------------------------------+
|                                                                                  |
|   +-----------------------------------------+   +----------------------------+   |
|   |         RELATIONAL WORKLOADS            |   |    TIME-SERIES WORKLOADS   |   |
|   | (PostgreSQL Standard B-Tree & MVCC)     |   |   (TimescaleDB Hypertables)|   |
|   +-----------------------------------------+   +----------------------------+   |
|   | • User Accounts & Authentication        |   | • Raw Price History        |   |
|   | • Asset & Exchange Catalogs             |   |   (High-frequency ticks)   |   |
|   | • Portfolios, Holdings & Transactions   |   | • Continuous Aggregates    |   |
|   | • Alerts, Notifications & Audit Logs    |   |   (Hourly OHLCV Candles)   |   |
|   | • 24h Ticker Stats & Price Cache        |   | • Automated Chunk Pruning  |   |
|   +-----------------------------------------+   +----------------------------+   |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

---

## 2. Table Classification: Relational vs. Time-Series Hypertables

### A. Primary Time-Series Hypertable: `price_history`
- **Role**: Ingests streaming price updates, order book ticks, and trade executions across stocks and cryptocurrencies.
- **Why a Hypertable?**:
  1. In traditional PostgreSQL, high-frequency price data causes massive index bloat in `idx_price_history_sym_time`. As the table grows beyond RAM capacity, B-Tree lookups and write locks degrade insertion rates.
  2. TimescaleDB partitions `price_history` into contiguous time-based **chunks** (tables under the hood). Writes always hit the newest chunk, keeping working indexes completely in RAM.
  3. Time-window queries (e.g. `WHERE timestamp >= NOW() - INTERVAL '24 hours'`) employ **chunk exclusion**, reading only relevant chunk files without touching historical tables.
  4. Compression and retention policies operate at chunk granularity with near-zero overhead.

### B. Evaluation of `ticker_stats` (Relational Snapshot Lookup)
- **Schema**: `asset_id UUID PRIMARY KEY`, `price_per_unit`, `volume_24h`, `high_24h`, `low_24h`, `updated_at`.
- **Evaluation**: `ticker_stats` maintains an exact **1:1 relationship** with the `assets` catalog. Its operational pattern consists of high-speed in-place updates (`ON CONFLICT (asset_id) DO UPDATE`).
- **Conclusion**: Converting `ticker_stats` to a hypertable would break its 1:1 primary key constraint (since TimescaleDB requires the partitioning column in unique keys) and destroy its fast dimensional point-lookup performance. **It must remain a traditional relational table.**

### C. Evaluation of `portfolio_performance` (Candidate Secondary Hypertable)
- **Schema**: `performance_id UUID PRIMARY KEY`, `portfolio_id UUID`, `total_value`, `total_profit_loss`, `total_profit_loss_pct`, `timestamp`.
- **Evaluation**: `portfolio_performance` represents periodic historical snapshots of portfolio net asset values (NAV) for equity charts.
- **Conclusion**:
  - In low-to-medium volume systems (daily snapshots per portfolio), a standard relational table with compound index `(portfolio_id, timestamp DESC)` performs with sub-millisecond efficiency.
  - In high-frequency enterprise systems (second-by-second NAV recalculations), it can be converted to a hypertable partitioned by `timestamp` with primary key `(performance_id, timestamp)`. In this implementation, it is preserved as an indexed relational table with full hypertable upgrade scripts provided.

---

## 3. TimescaleDB Compatibility Requirements and Schema Changes

When migrating from PostgreSQL to TimescaleDB, specific constraints must be addressed:

| Component | Standard PostgreSQL (DA-2) | TimescaleDB Compatible Schema | Rationale for Change |
| :--- | :--- | :--- | :--- |
| **`price_history` Primary Key** | `PRIMARY KEY (history_id)` | `PRIMARY KEY (history_id, timestamp)` | TimescaleDB requires that any `UNIQUE` or `PRIMARY KEY` constraint on a hypertable include all partitioning columns (`timestamp`). A single-column UUID PK triggers an immediate syntax error. |
| **Foreign Key References** | `CONSTRAINT fk_history_asset FOREIGN KEY (asset_id) REFERENCES assets(asset_id)` | Supported unchanged: Hypertable $\to$ Relational table FK is valid. | TimescaleDB fully supports foreign keys from a hypertable referencing a standard relational table. |
| **Chunk Time Interval** | N/A (single flat table) | `chunk_time_interval => INTERVAL '1 day'` | Configured to 1 day so that each chunk contains 24 hours of market ticks, matching daily trading sessions and rolling stats windows. |
| **Analytical Windowing** | Custom window functions or manual group by | Native `time_bucket('1 hour', timestamp)` | Native C-level bucketing executes significantly faster and seamlessly handles arbitrary intervals. |
| **OHLC Bar Generation** | Subqueries / CTEs with row numbers | Native `first(price, timestamp)` and `last(price, timestamp)` | TimescaleDB analytical aggregates retain state and extract open/close prices in a single sequential pass. |

---

## 4. Complete Relational Table Specifications

### 1. `currency_rates`
- **Purpose**: Global currency exchange rate reference relative to USD base.
- **Columns**:
  - `currency_code VARCHAR(10) PRIMARY KEY`
  - `rate_to_usd NUMERIC(18, 6) NOT NULL CHECK (rate_to_usd > 0)`
  - `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`

### 2. `users`
- **Purpose**: Authenticated application users and base currency preference.
- **Columns**:
  - `user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `email VARCHAR(255) UNIQUE NOT NULL`
  - `password_hash VARCHAR(255) NOT NULL`
  - `base_currency VARCHAR(10) DEFAULT 'USD' NOT NULL`
  - `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Foreign Keys**: `base_currency` references `currency_rates(currency_code)` ON UPDATE CASCADE.
- **Indexes**: `idx_users_email` on `users(email)`.

### 3. `exchanges`
- **Purpose**: Global physical and decentralized trading venues.
- **Columns**:
  - `exchange_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `name VARCHAR(100) NOT NULL`
  - `country VARCHAR(100) NOT NULL`
  - `url VARCHAR(500)`

### 4. `assets`
- **Purpose**: Polymorphic catalog containing both crypto tokens and equities.
- **Columns**:
  - `asset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `symbol VARCHAR(20) UNIQUE NOT NULL`
  - `name VARCHAR(150) NOT NULL`
  - `type VARCHAR(20) NOT NULL CHECK (type IN ('crypto', 'stock'))`
  - `network VARCHAR(100)`
  - `contract_address VARCHAR(255)`
  - `ticker_exchange VARCHAR(50)`
  - `sector VARCHAR(100)`
  - `exchange_id UUID`
  - `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Foreign Keys**: `exchange_id` references `exchanges(exchange_id)` ON DELETE SET NULL.
- **Indexes**: `idx_assets_symbol` on `assets(symbol)`, `idx_assets_type` on `assets(type)`.

### 5. `ticker_stats`
- **Purpose**: Real-time 24-hour high/low/volume snapshot per asset.
- **Columns**:
  - `asset_id UUID PRIMARY KEY`
  - `price_per_unit NUMERIC(18, 6) NOT NULL DEFAULT 0.0`
  - `volume_24h NUMERIC(24, 2) DEFAULT 0.0`
  - `high_24h NUMERIC(18, 6) DEFAULT 0.0`
  - `low_24h NUMERIC(18, 6) DEFAULT 0.0`
  - `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Foreign Keys**: `asset_id` references `assets(asset_id)` ON DELETE CASCADE.

### 6. `portfolios`
- **Purpose**: User-scoped investment portfolio containers.
- **Columns**:
  - `portfolio_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `user_id UUID NOT NULL`
  - `name VARCHAR(100) NOT NULL`
  - `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Foreign Keys**: `user_id` references `users(user_id)` ON DELETE CASCADE.
- **Indexes**: `idx_portfolios_user_id` on `portfolios(user_id)`.

### 7. `holdings`
- **Purpose**: Current aggregated active positions per portfolio.
- **Columns**:
  - `holding_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `portfolio_id UUID NOT NULL`
  - `asset_id UUID`
  - `symbol VARCHAR(20) NOT NULL`
  - `name VARCHAR(150) NOT NULL`
  - `type VARCHAR(20) NOT NULL CHECK (type IN ('crypto', 'stock'))`
  - `quantity NUMERIC(24, 8) NOT NULL CHECK (quantity >= 0)`
  - `average_buy_price NUMERIC(18, 6) NOT NULL CHECK (average_buy_price >= 0)`
  - `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Constraints**: `UNIQUE(portfolio_id, symbol)`.
- **Foreign Keys**: `portfolio_id` references `portfolios(portfolio_id)` ON DELETE CASCADE; `asset_id` references `assets(asset_id)` ON DELETE SET NULL.
- **Indexes**: `idx_holdings_portfolio_id`, `idx_holdings_symbol`.

### 8. `transactions`
- **Purpose**: Immutable audit ledger recording every trade execution.
- **Columns**:
  - `transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `user_id UUID NOT NULL`
  - `portfolio_id UUID NOT NULL`
  - `asset_id UUID`
  - `symbol VARCHAR(20) NOT NULL`
  - `type VARCHAR(20) NOT NULL CHECK (type IN ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT'))`
  - `quantity NUMERIC(24, 8) NOT NULL CHECK (quantity > 0)`
  - `price_at_transaction NUMERIC(18, 6) NOT NULL CHECK (price_at_transaction >= 0)`
  - `network_hash VARCHAR(255)`
  - `timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Foreign Keys**: `user_id` references `users(user_id)` ON DELETE CASCADE; `portfolio_id` references `portfolios(portfolio_id)` ON DELETE CASCADE; `asset_id` references `assets(asset_id)` ON DELETE SET NULL.
- **Indexes**: `idx_tx_portfolio_time` on `transactions(portfolio_id, timestamp DESC)`, `idx_tx_user`.

### 9. `portfolio_performance`
- **Purpose**: Historical equity curve and return snapshots.
- **Columns**:
  - `performance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `portfolio_id UUID NOT NULL`
  - `total_value NUMERIC(18, 2) NOT NULL`
  - `total_profit_loss NUMERIC(18, 2) NOT NULL`
  - `total_profit_loss_pct NUMERIC(8, 4) NOT NULL`
  - `timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Foreign Keys**: `portfolio_id` references `portfolios(portfolio_id)` ON DELETE CASCADE.
- **Indexes**: `idx_perf_portfolio_time` on `(portfolio_id, timestamp DESC)`.

### 10. `watchlists`
- **Purpose**: Named lists of tracked assets created by users.
- **Columns**:
  - `watchlist_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `user_id UUID NOT NULL`
  - `name VARCHAR(100) NOT NULL`
  - `creation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Foreign Keys**: `user_id` references `users(user_id)` ON DELETE CASCADE.

### 11. `watchlist_items`
- **Purpose**: Individual asset entries within a watchlist.
- **Columns**:
  - `item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `watchlist_id UUID NOT NULL`
  - `symbol VARCHAR(20) NOT NULL`
  - `asset_id UUID`
  - `added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Constraints**: `UNIQUE(watchlist_id, symbol)`.
- **Foreign Keys**: `watchlist_id` references `watchlists(watchlist_id)` ON DELETE CASCADE; `asset_id` references `assets(asset_id)` ON DELETE SET NULL.
- **Indexes**: `idx_watchlist_items_watchlist`.

### 12. `alerts`
- **Purpose**: User-configured price threshold triggers.
- **Columns**:
  - `alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `user_id UUID NOT NULL`
  - `symbol VARCHAR(20) NOT NULL`
  - `asset_id UUID`
  - `threshold NUMERIC(18, 6) NOT NULL CHECK (threshold > 0)`
  - `direction VARCHAR(10) NOT NULL CHECK (direction IN ('ABOVE', 'BELOW'))`
  - `enabled BOOLEAN DEFAULT TRUE NOT NULL`
  - `triggered_at TIMESTAMP WITH TIME ZONE`
  - `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Foreign Keys**: `user_id` references `users(user_id)` ON DELETE CASCADE; `asset_id` references `assets(asset_id)` ON DELETE SET NULL.
- **Indexes**: `idx_alerts_user_enabled` on `(user_id, enabled)`.

### 13. `notifications`
- **Purpose**: Outbox log of dispatched alert messages.
- **Columns**:
  - `notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `alert_id UUID NOT NULL`
  - `user_id UUID NOT NULL`
  - `channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'PUSH', 'IN_APP'))`
  - `status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED'))`
  - `sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Foreign Keys**: `alert_id` references `alerts(alert_id)` ON DELETE CASCADE; `user_id` references `users(user_id)` ON DELETE CASCADE.

### 14. `price_history` (TimescaleDB Hypertable)
- **Purpose**: Immutable time-series of market ticks and prices.
- **Columns**:
  - `history_id UUID DEFAULT uuid_generate_v4() NOT NULL`
  - `symbol VARCHAR(20) NOT NULL`
  - `asset_id UUID`
  - `price NUMERIC(18, 6) NOT NULL`
  - `volume NUMERIC(24, 2)`
  - `timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Constraints**: `PRIMARY KEY (history_id, timestamp)`.
- **Foreign Keys**: `asset_id` references `assets(asset_id)` ON DELETE SET NULL.
- **Indexes**: `idx_price_history_sym_time` on `(symbol, timestamp DESC)`, `idx_price_history_asset_time` on `(asset_id, timestamp DESC)`.

### 15. `news_articles`
- **Purpose**: Market intelligence and financial news headlines.
- **Columns**:
  - `article_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `headline VARCHAR(500) NOT NULL`
  - `source VARCHAR(100) NOT NULL`
  - `url VARCHAR(1000) NOT NULL`
  - `published_at TIMESTAMP WITH TIME ZONE NOT NULL`

### 16. `news_article_assets`
- **Purpose**: Many-to-many junction table associating news articles with assets.
- **Columns**:
  - `article_id UUID NOT NULL`
  - `asset_id UUID NOT NULL`
- **Constraints**: `PRIMARY KEY (article_id, asset_id)`.
- **Foreign Keys**: `article_id` references `news_articles(article_id)` ON DELETE CASCADE; `asset_id` references `assets(asset_id)` ON DELETE CASCADE.

### 17. `price_cache`
- **Purpose**: Short-term TTL cache for live external API quotes.
- **Columns**:
  - `cache_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `symbol VARCHAR(20) NOT NULL`
  - `asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('crypto', 'stock'))`
  - `price_usd NUMERIC(18, 6) NOT NULL`
  - `high_24h NUMERIC(18, 6)`
  - `low_24h NUMERIC(18, 6)`
  - `volume_24h NUMERIC(24, 2)`
  - `change_24h NUMERIC(8, 4)`
  - `fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
  - `expire_at TIMESTAMP WITH TIME ZONE NOT NULL`
  - `metadata JSONB`
- **Constraints**: `UNIQUE(symbol, asset_type)`.
- **Indexes**: `idx_price_cache_expire` on `price_cache(expire_at)`.

### 18. `audit_logs`
- **Purpose**: Regulatory audit trail tracking critical security and transaction events.
- **Columns**:
  - `log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
  - `user_id UUID NOT NULL`
  - `action VARCHAR(255) NOT NULL`
  - `timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
- **Foreign Keys**: `user_id` references `users(user_id)` ON DELETE CASCADE.
- **Indexes**: `idx_audit_user_time` on `audit_logs(user_id, timestamp DESC)`.
