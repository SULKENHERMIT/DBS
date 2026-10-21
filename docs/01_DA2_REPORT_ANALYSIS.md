# Digital Assignment 02 (DA-2) Report Analysis & Source of Truth Audit

## 1. Project Background and Metadata

| Attribute | Project Specification |
| :--- | :--- |
| **Project Title** | Live Crypto and Stock Analysis Platform |
| **Academic Course** | Database Systems (Digital Assignment – 02 & 03) |
| **Class Slot** | F2 + TF2 |
| **Project Team Members** | 1. **Narendran R** (Reg. No: 25BDS1161)<br>2. **Palaniappan R.M** (Reg. No: 25BDS1148)<br>3. **Kayelesh P** (Reg. No: 25BDS1040) |
| **Primary Source Document** | DA-2 Laboratory Report & SQL Screenshots (`run_all.sql` executed in Query Tool) |

### Problem Statement
> *"Retail and novice investors struggle to make timely, informed decisions in highly volatile crypto and stock markets due to scattered data sources, delayed price updates, and lack of consolidated analytical tools. Existing platforms often provide either raw price feeds or generic news, without real-time, actionable insights combining price trends, market sentiment, and predictive analytics in one place. This gap leads to poor decision-making, missed opportunities, and increased financial risk for individual investors who lack access to institutional-grade, real-time market intelligence."*

---

## 2. Comprehensive Inventory of the 18 Database Tables

The DA-2 report defines exactly 18 relational tables. Below is the complete structural audit preserving their exact schemas, data types, and constraints:

| Table No. | Table Name | Category | Primary Key | Foreign Keys & Target Tables | Key Constraints & Integrity Rules |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | `currency_rates` | Reference Lookup | `currency_code` (VARCHAR 10) | None | `rate_to_usd > 0`, default timestamp |
| **2** | `users` | Core Relational | `user_id` (UUID) | `base_currency` -> `currency_rates(currency_code)` ON UPDATE CASCADE | `email` UNIQUE, default base currency 'USD' |
| **3** | `exchanges` | Reference Catalog | `exchange_id` (UUID) | None | `name` NOT NULL, `country` NOT NULL |
| **4** | `assets` | Polymorphic Catalog | `asset_id` (UUID) | `exchange_id` -> `exchanges(exchange_id)` ON DELETE SET NULL | `symbol` UNIQUE, `type IN ('crypto', 'stock')` |
| **5** | `ticker_stats` | Relational 1:1 Cache | `asset_id` (UUID) | `asset_id` -> `assets(asset_id)` ON DELETE CASCADE | 1:1 relation with assets, non-negative defaults |
| **6** | `portfolios` | Relational Container | `portfolio_id` (UUID) | `user_id` -> `users(user_id)` ON DELETE CASCADE | Multi-portfolio container per user |
| **7** | `holdings` | Transactional State | `holding_id` (UUID) | `portfolio_id` -> `portfolios(portfolio_id)` ON DELETE CASCADE<br>`asset_id` -> `assets(asset_id)` ON DELETE SET NULL | `quantity >= 0`, `average_buy_price >= 0`, `UNIQUE(portfolio_id, symbol)` |
| **8** | `transactions` | Immutable Ledger | `transaction_id` (UUID) | `user_id` -> `users(user_id)` ON DELETE CASCADE<br>`portfolio_id` -> `portfolios(portfolio_id)` ON DELETE CASCADE<br>`asset_id` -> `assets(asset_id)` ON DELETE SET NULL | `quantity > 0`, `price_at_transaction >= 0`, `type IN ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT')` |
| **9** | `portfolio_performance`| Time-Series Snapshots| `performance_id` (UUID) | `portfolio_id` -> `portfolios(portfolio_id)` ON DELETE CASCADE | Periodic NAV snapshots with profit/loss metrics |
| **10** | `watchlists` | User Personalization | `watchlist_id` (UUID) | `user_id` -> `users(user_id)` ON DELETE CASCADE | User watchlist groupings |
| **11** | `watchlist_items` | Tracked Junction | `item_id` (UUID) | `watchlist_id` -> `watchlists(watchlist_id)` ON DELETE CASCADE<br>`asset_id` -> `assets(asset_id)` ON DELETE SET NULL | `UNIQUE(watchlist_id, symbol)` |
| **12** | `alerts` | Event Rules | `alert_id` (UUID) | `user_id` -> `users(user_id)` ON DELETE CASCADE<br>`asset_id` -> `assets(asset_id)` ON DELETE SET NULL | `threshold > 0`, `direction IN ('ABOVE', 'BELOW')` |
| **13** | `notifications` | Dispatch Logs | `notification_id` (UUID) | `alert_id` -> `alerts(alert_id)` ON DELETE CASCADE<br>`user_id` -> `users(user_id)` ON DELETE CASCADE | `channel IN ('EMAIL', 'SMS', 'PUSH', 'IN_APP')`, `status IN ('PENDING', 'SENT', 'FAILED')` |
| **14** | `price_history` | Granular Time-Series | `history_id` (UUID)* | `asset_id` -> `assets(asset_id)` ON DELETE SET NULL | High-frequency ticks/hourly historical records |
| **15** | `news_articles` | Content Feed | `article_id` (UUID) | None | `headline` NOT NULL, `published_at` NOT NULL |
| **16** | `news_article_assets` | Many-to-Many Junction | `(article_id, asset_id)` | `article_id` -> `news_articles` ON DELETE CASCADE<br>`asset_id` -> `assets` ON DELETE CASCADE | Composite PK linking news articles to assets |
| **17** | `price_cache` | Volatile Memory Cache | `cache_id` (UUID) | None | `UNIQUE(symbol, asset_type)`, TTL column `expire_at` |
| **18** | `audit_logs` | Compliance Trail | `log_id` (UUID) | `user_id` -> `users(user_id)` ON DELETE CASCADE | Immutable user action audit log |

*\*Note on `price_history` Primary Key*: In the original DA-2 schema, `history_id` was the single primary key. Under TimescaleDB, unique/primary constraints on hypertables must include the partitioning column (`timestamp`). Thus, for TimescaleDB compatibility, the primary key becomes the composite `(history_id, timestamp)`.

---

## 3. Analysis of Indexes Documented in DA-2

The original report created 14 performance and relational indexes:

1. `idx_users_email`: B-Tree index on `users(email)` for sub-millisecond login authentication.
2. `idx_assets_symbol`: B-Tree index on `assets(symbol)` for quick ticker discovery.
3. `idx_assets_type`: B-Tree index on `assets(type)` for filtering stocks vs. cryptocurrencies.
4. `idx_portfolios_user_id`: Foreign key lookup index on `portfolios(user_id)`.
5. `idx_holdings_portfolio_id`: Foreign key index on `holdings(portfolio_id)` for loading user positions.
6. `idx_holdings_symbol`: Index on `holdings(symbol)` for upsert conflict checking and price joins.
7. `idx_tx_portfolio_time`: Compound index on `transactions(portfolio_id, timestamp DESC)` for fast ledger retrieval.
8. `idx_tx_user`: Foreign key index on `transactions(user_id)` for user audit histories.
9. `idx_perf_portfolio_time`: Compound index on `portfolio_performance(portfolio_id, timestamp DESC)` for NAV chart generation.
10. `idx_watchlist_items_watchlist`: Foreign key index on `watchlist_items(watchlist_id)`.
11. `idx_alerts_user_enabled`: Compound partial/filtered index pattern on `alerts(user_id, enabled)` for real-time alerting worker checks.
12. `idx_price_history_sym_time`: Compound index on `price_history(symbol, timestamp DESC)` for historical price lookups.
13. `idx_price_cache_expire`: Index on `price_cache(expire_at)` for fast TTL cleanup.
14. `idx_audit_user_time`: Compound index on `audit_logs(user_id, timestamp DESC)` for compliance review.

---

## 4. Analysis of PL/pgSQL Triggers, Procedures, and Functions

The DA-2 report documented 9 PL/pgSQL database routines:

1. `update_holdings_timestamp()`:
   - **Type**: `BEFORE UPDATE` Trigger Function on `holdings`.
   - **Functionality**: Automatically overwrites `NEW.updated_at := CURRENT_TIMESTAMP`.

2. `log_transaction_activity()`:
   - **Type**: `AFTER INSERT` Trigger Function on `transactions`.
   - **Functionality**: Synchronously writes an audit log into `audit_logs` capturing user ID, transaction type, quantity, symbol, price, and timestamp with action text `TRADE_EXECUTION: <TYPE> <QTY> <SYM> @ <PRICE>`.

3. `upsert_holding()`:
   - **Type**: Stored Procedure / Function.
   - **Functionality**: Validates that quantity $> 0$, buy price $\ge 0$, and type $\in (\text{'crypto'}, \text{'stock'})$. Performs an atomic upsert on `holdings` recalculating the weighted average buy price:
     $$\text{New Average Buy Price} = \frac{(Q_{\text{existing}} \times P_{\text{existing}}) + (Q_{\text{incoming}} \times P_{\text{incoming}})}{Q_{\text{existing}} + Q_{\text{incoming}}}$$

4. `record_transaction_and_update_holding()`:
   - **Type**: Transactional Coordinator Function.
   - **Functionality**: Atomically executes trade operations. For `BUY` or `TRANSFER_IN`, it invokes the weighted-average upsert. For `SELL` or `TRANSFER_OUT`, it validates balance availability, throws custom exceptions on overdrafts, deletes the holding if the position is fully exited, or decreases the holding quantity while maintaining average cost basis. Finally, it logs the transaction to `transactions` (which triggers `log_transaction_activity`).

5. `check_price_alerts()`:
   - **Type**: Automated Alert Evaluation Routine.
   - **Functionality**: Iterates over active price alerts (`enabled = TRUE`), compares target thresholds against live prices resolved from `price_cache` or `ticker_stats`, logs notifications into `notifications` (`status = 'PENDING'`, `channel = 'IN_APP'`), and deactivates triggered alerts.

6. `get_portfolio_valuation()`:
   - **Type**: Table-Valued Analytical Function.
   - **Functionality**: Computes live market valuation for all positions in a portfolio. Joins `holdings`, `portfolios`, `users`, `currency_rates`, `assets`, `ticker_stats`, and `price_cache`. Computes `cost_basis`, `market_value`, `unrealized_pnl`, `unrealized_pnl_pct`, and base-currency converted values.

7. `record_portfolio_snapshot()`:
   - **Type**: Analytical State Recorder.
   - **Functionality**: Aggregates total portfolio market value and total cost basis, computes total profit/loss percentage, and appends a record to `portfolio_performance`.

8. `expire_price_cache()`:
   - **Type**: Maintenance Garbage Collection Procedure.
   - **Functionality**: Purges all entries from `price_cache` where `expire_at <= CURRENT_TIMESTAMP` and returns the deleted row count.

9. `refresh_ticker_stats()`:
   - **Type**: Analytical Rolling Statistics Generator.
   - **Functionality**: Queries `price_history` over the last 24 hours (`timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`), calculates 24h High, 24h Low, and 24h Volume, finds the most recent price, and upserts into `ticker_stats`.

---

## 5. Sample Dataset and Verification Baseline

### Baseline Entities
- **Currencies**: 6 active currencies (USD, EUR, GBP, JPY, CAD, AUD).
- **Users**: 3 test users (`investor@example.com`, `crypto_trader@example.com`, `tech_analyst@example.com`).
- **Exchanges**: 4 global exchanges (Binance, Coinbase, NASDAQ, NYSE).
- **Assets**: 6 assets (Crypto: BTC, ETH, SOL; Stocks: AAPL, NVDA, TSLA).
- **Portfolios**: 3 portfolios (`Growth & Multi-Asset Fund`, `Long Term Cold Storage`, `High Beta Crypto-Portfolio`).
- **Sample Portfolio Valuation Baseline** (`Growth & Multi-Asset Fund` - `11111111-1111-1111-1111-111111111111`):
  - **BTC**: Qty `1.25`, Avg Buy `$58,200.00`, Current Price `$64,500.00`, Cost Basis `$72,750.00`, Market Value `$80,625.00`, Unrealized P/L `+$7,875.00` (+10.8247%)
  - **ETH**: Qty `8.50`, Avg Buy `$3,100.00`, Current Price `$3,450.00`, Cost Basis `$26,350.00`, Market Value `$29,325.00`, Unrealized P/L `+$2,975.00` (+11.2903%)
  - **AAPL**: Qty `50.00`, Avg Buy `$210.00`, Current Price `$228.75`, Cost Basis `$10,500.00`, Market Value `$11,437.50`, Unrealized P/L `+$937.50` (+8.9286%)
  - **NVDA**: Qty `80.00`, Avg Buy `$105.50`, Current Price `$124.50`, Cost Basis `$8,440.00`, Market Value `$9,960.00`, Unrealized P/L `+$1,520.00` (+18.0095%)
  - **Aggregated Totals**:
    - **Total Invested Cost Basis**: `$108,040.00`
    - **Total Portfolio Market Value**: `$131,347.50`
    - **Total Unrealized Profit**: `+$23,307.50` (+21.5730%)
