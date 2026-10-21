# Entity-Relationship (ER) Diagram & Relational Cardinality

The following diagram models the entire database structure of the **Live Crypto and Stock Analysis Platform**, capturing all 18 tables, their primary keys, foreign keys, cardinality, and the hypertable relationship between `assets` and `price_history`.

```mermaid
erDiagram
    CURRENCY_RATES ||--o{ USERS : "base_currency"
    USERS ||--o{ PORTFOLIOS : "user_id"
    USERS ||--o{ WATCHLISTS : "user_id"
    USERS ||--o{ ALERTS : "user_id"
    USERS ||--o{ NOTIFICATIONS : "user_id"
    USERS ||--o{ TRANSACTIONS : "user_id"
    USERS ||--o{ AUDIT_LOGS : "user_id"

    EXCHANGES ||--o{ ASSETS : "exchange_id"
    
    ASSETS ||--|| TICKER_STATS : "asset_id (1:1)"
    ASSETS ||--o{ HOLDINGS : "asset_id"
    ASSETS ||--o{ TRANSACTIONS : "asset_id"
    ASSETS ||--o{ WATCHLIST_ITEMS : "asset_id"
    ASSETS ||--o{ ALERTS : "asset_id"
    ASSETS ||--o{ PRICE_HISTORY : "asset_id (1:N Hypertable)"
    ASSETS ||--o{ NEWS_ARTICLE_ASSETS : "asset_id"

    NEWS_ARTICLES ||--o{ NEWS_ARTICLE_ASSETS : "article_id"

    PORTFOLIOS ||--o{ HOLDINGS : "portfolio_id"
    PORTFOLIOS ||--o{ TRANSACTIONS : "portfolio_id"
    PORTFOLIOS ||--o{ PORTFOLIO_PERFORMANCE : "portfolio_id"

    WATCHLISTS ||--o{ WATCHLIST_ITEMS : "watchlist_id"

    ALERTS ||--o{ NOTIFICATIONS : "alert_id"

    CURRENCY_RATES {
        varchar currency_code PK
        numeric rate_to_usd
        timestamptz updated_at
    }

    USERS {
        uuid user_id PK
        varchar email
        varchar password_hash
        varchar base_currency FK
        timestamptz created_at
    }

    EXCHANGES {
        uuid exchange_id PK
        varchar name
        varchar country
        varchar url
    }

    ASSETS {
        uuid asset_id PK
        varchar symbol
        varchar name
        varchar type
        varchar network
        varchar contract_address
        varchar ticker_exchange
        varchar sector
        uuid exchange_id FK
        timestamptz created_at
    }

    TICKER_STATS {
        uuid asset_id PK,FK
        numeric price_per_unit
        numeric volume_24h
        numeric high_24h
        numeric low_24h
        timestamptz updated_at
    }

    PORTFOLIOS {
        uuid portfolio_id PK
        uuid user_id FK
        varchar name
        timestamptz created_at
    }

    HOLDINGS {
        uuid holding_id PK
        uuid portfolio_id FK
        uuid asset_id FK
        varchar symbol
        varchar name
        varchar type
        numeric quantity
        numeric average_buy_price
        timestamptz updated_at
    }

    TRANSACTIONS {
        uuid transaction_id PK
        uuid user_id FK
        uuid portfolio_id FK
        uuid asset_id FK
        varchar symbol
        varchar type
        numeric quantity
        numeric price_at_transaction
        varchar network_hash
        timestamptz timestamp
    }

    PORTFOLIO_PERFORMANCE {
        uuid performance_id PK
        uuid portfolio_id FK
        numeric total_value
        numeric total_profit_loss
        numeric total_profit_loss_pct
        timestamptz timestamp
    }

    WATCHLISTS {
        uuid watchlist_id PK
        uuid user_id FK
        varchar name
        timestamptz creation_date
    }

    WATCHLIST_ITEMS {
        uuid item_id PK
        uuid watchlist_id FK
        uuid asset_id FK
        varchar symbol
        timestamptz added_at
    }

    ALERTS {
        uuid alert_id PK
        uuid user_id FK
        uuid asset_id FK
        varchar symbol
        numeric threshold
        varchar direction
        boolean enabled
        timestamptz triggered_at
        timestamptz created_at
    }

    NOTIFICATIONS {
        uuid notification_id PK
        uuid alert_id FK
        uuid user_id FK
        varchar channel
        varchar status
        timestamptz sent_at
    }

    PRICE_HISTORY {
        uuid history_id PK
        timestamptz timestamp PK
        varchar symbol
        uuid asset_id FK
        numeric price
        numeric volume
    }

    NEWS_ARTICLES {
        uuid article_id PK
        varchar headline
        varchar source
        varchar url
        timestamptz published_at
    }

    NEWS_ARTICLE_ASSETS {
        uuid article_id PK,FK
        uuid asset_id PK,FK
    }

    PRICE_CACHE {
        uuid cache_id PK
        varchar symbol
        varchar asset_type
        numeric price_usd
        numeric high_24h
        numeric low_24h
        numeric volume_24h
        numeric change_24h
        timestamptz fetched_at
        timestamptz expire_at
        jsonb metadata
    }

    AUDIT_LOGS {
        uuid log_id PK
        uuid user_id FK
        varchar action
        timestamptz timestamp
    }
```

---

## Relational Cardinality and Integrity Matrix

| Relationship | Cardinality | Enforced By | Business Rule |
| :--- | :---: | :--- | :--- |
| `currency_rates` $\to$ `users` | $1 : N$ | `fk_users_currency` ON UPDATE CASCADE | Every user selects an active base currency. Exchange rate changes propagate automatically. |
| `users` $\to$ `portfolios` | $1 : N$ | `fk_portfolios_user` ON DELETE CASCADE | A user can own multiple distinct portfolios (e.g., Growth, Cold Storage). |
| `portfolios` $\to$ `holdings` | $1 : N$ | `fk_holdings_portfolio` ON DELETE CASCADE | Portfolios contain zero or more current asset positions. |
| `portfolios` $\times$ `symbol` | $1 : 1$ | `uq_portfolio_symbol` UNIQUE Constraint | Each symbol appears at most once per portfolio with aggregated weighted-average cost. |
| `portfolios` $\to$ `transactions` | $1 : N$ | `fk_tx_portfolio` ON DELETE CASCADE | Immutable audit history of all trades conducted in the portfolio. |
| `portfolios` $\to$ `portfolio_performance` | $1 : N$ | `fk_perf_portfolio` ON DELETE CASCADE | Chronological time-series snapshots of portfolio valuation over time. |
| `users` $\to$ `watchlists` | $1 : N$ | `fk_watchlists_user` ON DELETE CASCADE | Users can configure custom asset monitor lists. |
| `watchlists` $\to$ `watchlist_items` | $1 : N$ | `fk_wl_items_watchlist` ON DELETE CASCADE | Watchlists contain tracked asset items (`uq_watchlist_symbol`). |
| `users` $\to$ `alerts` | $1 : N$ | `fk_alerts_user` ON DELETE CASCADE | Users register price notification rules. |
| `alerts` $\to$ `notifications` | $1 : N$ | `fk_notif_alert` ON DELETE CASCADE | When an alert triggers, one or more notification logs are dispatched. |
| `assets` $\to$ `ticker_stats` | $1 : 1$ | `fk_ticker_stats_asset` ON DELETE CASCADE | Each catalog asset has exactly one current 24-hour summary record. |
| `assets` $\to$ `price_history` | $1 : N$ | `fk_history_asset` ON DELETE SET NULL | High-frequency time-series observations partitioned into TimescaleDB chunks. |
| `news_articles` $\leftrightarrow$ `assets` | $M : N$ | `news_article_assets` composite PK | Articles can relate to multiple assets, and assets can be cited in multiple articles. |
| `price_cache` | Standalone | `uq_cache_symbol_type` | Ephemeral caching layer with expiration timestamps (`expire_at`). |
| `users` $\to$ `audit_logs` | $1 : N$ | `fk_audit_user` ON DELETE CASCADE | Compliance trail for regulatory tracking and trade transparency. |
