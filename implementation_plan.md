# Implementation Plan: Relational SQL Database Schema & Query Specification

This implementation plan provides the complete **SQL (PostgreSQL / MySQL compatible)** schema specifications, Data Definition Language (DDL) table definitions with relational constraints and indexes, Data Manipulation Language (DML) CRUD queries, and advanced analytical SQL aggregation queries for the Live Stock & Cryptocurrency Portfolio Management System.

---

## 1. Relational Database Schema (DDL)

```sql
-- ============================================================================
-- 1. EXTENSIONS & SETUP
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. CURRENCY RATES TABLE
-- ============================================================================
CREATE TABLE currency_rates (
    currency_code VARCHAR(10) PRIMARY KEY,
    rate_to_usd NUMERIC(18, 6) NOT NULL CHECK (rate_to_usd > 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================================================
-- 3. USERS TABLE
-- ============================================================================
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    base_currency VARCHAR(10) DEFAULT 'USD' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_users_currency FOREIGN KEY (base_currency) REFERENCES currency_rates (currency_code) ON UPDATE CASCADE
);

CREATE INDEX idx_users_email ON users (email);

-- ============================================================================
-- 4. EXCHANGES TABLE
-- ============================================================================
CREATE TABLE exchanges (
    exchange_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    url VARCHAR(500)
);

-- ============================================================================
-- 5. ASSETS CATALOG (POLYMORPHIC TABLE)
-- ============================================================================
CREATE TABLE assets (
    asset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('crypto', 'stock')),
    network VARCHAR(100),            -- Crypto specific
    contract_address VARCHAR(255),   -- Crypto specific
    ticker_exchange VARCHAR(50),     -- Stock specific
    sector VARCHAR(100),             -- Stock specific
    exchange_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_assets_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges (exchange_id) ON DELETE SET NULL
);

CREATE INDEX idx_assets_symbol ON assets (symbol);
CREATE INDEX idx_assets_type ON assets (type);

-- ============================================================================
-- 6. TICKER STATS (1:1 EMBEDDED EQUIVALENT)
-- ============================================================================
CREATE TABLE ticker_stats (
    asset_id UUID PRIMARY KEY,
    price_per_unit NUMERIC(18, 6) NOT NULL DEFAULT 0.0,
    volume_24h NUMERIC(24, 2) DEFAULT 0.0,
    high_24h NUMERIC(18, 6) DEFAULT 0.0,
    low_24h NUMERIC(18, 6) DEFAULT 0.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_ticker_stats_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE CASCADE
);

-- ============================================================================
-- 7. PORTFOLIOS TABLE
-- ============================================================================
CREATE TABLE portfolios (
    portfolio_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_portfolios_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE INDEX idx_portfolios_user_id ON portfolios (user_id);

-- ============================================================================
-- 8. HOLDINGS TABLE
-- ============================================================================
CREATE TABLE holdings (
    holding_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL,
    asset_id UUID,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('crypto', 'stock')),
    quantity NUMERIC(24, 8) NOT NULL CHECK (quantity > 0),
    average_buy_price NUMERIC(18, 6) NOT NULL CHECK (average_buy_price >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_holdings_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (portfolio_id) ON DELETE CASCADE,
    CONSTRAINT fk_holdings_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL,
    CONSTRAINT uq_portfolio_symbol UNIQUE (portfolio_id, symbol)
);

CREATE INDEX idx_holdings_portfolio_id ON holdings (portfolio_id);
CREATE INDEX idx_holdings_symbol ON holdings (symbol);

-- ============================================================================
-- 9. TRANSACTIONS (TRADE EXECUTION LOG)
-- ============================================================================
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    portfolio_id UUID NOT NULL,
    asset_id UUID,
    symbol VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT')),
    quantity NUMERIC(24, 8) NOT NULL CHECK (quantity > 0),
    price_at_transaction NUMERIC(18, 6) NOT NULL CHECK (price_at_transaction >= 0),
    network_hash VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_tx_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (portfolio_id) ON DELETE CASCADE,
    CONSTRAINT fk_tx_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL
);

CREATE INDEX idx_tx_portfolio_time ON transactions (portfolio_id, timestamp DESC);
CREATE INDEX idx_tx_user ON transactions (user_id);

-- ============================================================================
-- 10. PORTFOLIO PERFORMANCE SNAPSHOTS
-- ============================================================================
CREATE TABLE portfolio_performance (
    performance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL,
    total_value NUMERIC(18, 2) NOT NULL,
    total_profit_loss NUMERIC(18, 2) NOT NULL,
    total_profit_loss_pct NUMERIC(8, 4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_perf_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (portfolio_id) ON DELETE CASCADE
);

CREATE INDEX idx_perf_portfolio_time ON portfolio_performance (portfolio_id, timestamp DESC);

-- ============================================================================
-- 11. WATCHLISTS & WATCHLIST ITEMS
-- ============================================================================
CREATE TABLE watchlists (
    watchlist_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    creation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_watchlists_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE watchlist_items (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watchlist_id UUID NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    asset_id UUID,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_wl_items_watchlist FOREIGN KEY (watchlist_id) REFERENCES watchlists (watchlist_id) ON DELETE CASCADE,
    CONSTRAINT fk_wl_items_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL,
    CONSTRAINT uq_watchlist_symbol UNIQUE (watchlist_id, symbol)
);

CREATE INDEX idx_watchlist_items_watchlist ON watchlist_items (watchlist_id);

-- ============================================================================
-- 12. ALERTS & NOTIFICATIONS
-- ============================================================================
CREATE TABLE alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    asset_id UUID,
    threshold NUMERIC(18, 6) NOT NULL CHECK (threshold > 0),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('ABOVE', 'BELOW')),
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_alerts_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_alerts_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL
);

CREATE INDEX idx_alerts_user_enabled ON alerts (user_id, enabled);

CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL,
    user_id UUID NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'PUSH', 'IN_APP')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_notif_alert FOREIGN KEY (alert_id) REFERENCES alerts (alert_id) ON DELETE CASCADE,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- ============================================================================
-- 13. PRICE HISTORY
-- ============================================================================
CREATE TABLE price_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    asset_id UUID,
    price NUMERIC(18, 6) NOT NULL,
    volume NUMERIC(24, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_history_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL
);

CREATE INDEX idx_price_history_sym_time ON price_history (symbol, timestamp DESC);

-- ============================================================================
-- 14. NEWS ARTICLES & JUNCTION TABLE
-- ============================================================================
CREATE TABLE news_articles (
    article_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    headline VARCHAR(500) NOT NULL,
    source VARCHAR(100) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE news_article_assets (
    article_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    PRIMARY KEY (article_id, asset_id),
    CONSTRAINT fk_naa_article FOREIGN KEY (article_id) REFERENCES news_articles (article_id) ON DELETE CASCADE,
    CONSTRAINT fk_naa_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE CASCADE
);

-- ============================================================================
-- 15. PRICE CACHE (FAST LOOKUP TABLE)
-- ============================================================================
CREATE TABLE price_cache (
    cache_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('crypto', 'stock')),
    price_usd NUMERIC(18, 6) NOT NULL,
    high_24h NUMERIC(18, 6),
    low_24h NUMERIC(18, 6),
    volume_24h NUMERIC(24, 2),
    change_24h NUMERIC(8, 4),
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expire_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,
    CONSTRAINT uq_cache_symbol_type UNIQUE (symbol, asset_type)
);

CREATE INDEX idx_price_cache_expire ON price_cache (expire_at);

-- ============================================================================
-- 16. AUDIT LOGS
-- ============================================================================
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    action VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_user_time ON audit_logs (user_id, timestamp DESC);
```

---

## 2. Core CRUD / DML SQL Queries

### Authentication & User Management
```sql
-- User Signup
INSERT INTO users (email, password_hash, base_currency)
VALUES ('trader@example.com', '$2b$12$...hashed_password...', 'USD')
RETURNING user_id, email, base_currency, created_at;

-- User Login Lookup
SELECT user_id, email, password_hash, base_currency 
FROM users 
WHERE email = 'trader@example.com';
```

### Portfolio Management
```sql
-- Create Portfolio
INSERT INTO portfolios (user_id, name)
VALUES ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Long Term Crypto')
RETURNING portfolio_id, user_id, name, created_at;

-- List All User Portfolios with Position Counts
SELECT p.portfolio_id, p.name, p.created_at, COUNT(h.holding_id) AS total_positions
FROM portfolios p
LEFT JOIN holdings h ON p.portfolio_id = h.portfolio_id
WHERE p.user_id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'
GROUP BY p.portfolio_id, p.name, p.created_at
ORDER BY p.created_at DESC;

-- Update Portfolio
UPDATE portfolios
SET name = 'Growth & Tech Portfolio'
WHERE portfolio_id = 'p1...' AND user_id = 'u1...';

-- Delete Portfolio
DELETE FROM portfolios
WHERE portfolio_id = 'p1...' AND user_id = 'u1...';
```

### Holdings Management
```sql
-- Upsert Holding Position (Add or Accumulate)
INSERT INTO holdings (portfolio_id, asset_id, symbol, name, type, quantity, average_buy_price)
VALUES ('p1...', 'a1...', 'BTC', 'Bitcoin', 'crypto', 1.5, 45000.00)
ON CONFLICT (portfolio_id, symbol)
DO UPDATE SET 
    quantity = holdings.quantity + EXCLUDED.quantity,
    average_buy_price = ((holdings.quantity * holdings.average_buy_price) + (EXCLUDED.quantity * EXCLUDED.average_buy_price)) / (holdings.quantity + EXCLUDED.quantity),
    updated_at = CURRENT_TIMESTAMP;

-- List Holdings for a Portfolio
SELECT h.holding_id, h.symbol, h.name, h.type, h.quantity, h.average_buy_price, h.updated_at
FROM holdings h
JOIN portfolios p ON h.portfolio_id = p.portfolio_id
WHERE p.portfolio_id = 'p1...' AND p.user_id = 'u1...'
ORDER BY h.symbol ASC;

-- Delete Holding
DELETE FROM holdings
WHERE holding_id = 'h1...' 
  AND portfolio_id IN (SELECT portfolio_id FROM portfolios WHERE user_id = 'u1...');
```

### Transaction Logging
```sql
-- Record Trade Transaction
INSERT INTO transactions (user_id, portfolio_id, asset_id, symbol, type, quantity, price_at_transaction, network_hash)
VALUES ('u1...', 'p1...', 'a1...', 'ETH', 'BUY', 5.0, 3200.00, '0xabc123...')
RETURNING transaction_id, timestamp;
```

---

## 3. Analytical & Aggregation SQL Queries

### 3.1 Real-Time Portfolio Valuation & Gain/Loss Calculation
```sql
SELECT 
    p.portfolio_id,
    p.name AS portfolio_name,
    h.symbol,
    h.type,
    h.quantity,
    h.average_buy_price,
    (h.quantity * h.average_buy_price) AS total_cost_basis,
    COALESCE(pc.price_usd, ts.price_per_unit, 0) AS current_price,
    (h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) AS current_market_value,
    (h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) - (h.quantity * h.average_buy_price) AS unrealized_pnl,
    CASE 
        WHEN (h.quantity * h.average_buy_price) > 0 
        THEN (((h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) - (h.quantity * h.average_buy_price)) / (h.quantity * h.average_buy_price)) * 100 
        ELSE 0 
    END AS unrealized_pnl_pct
FROM portfolios p
JOIN holdings h ON p.portfolio_id = h.portfolio_id
LEFT JOIN assets a ON h.symbol = a.symbol
LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
LEFT JOIN price_cache pc ON h.symbol = pc.symbol AND pc.expire_at > CURRENT_TIMESTAMP
WHERE p.user_id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
```

### 3.2 Portfolio Total Net Worth in User's Base Currency
```sql
SELECT 
    p.portfolio_id,
    p.name AS portfolio_name,
    u.base_currency,
    cr.rate_to_usd,
    SUM(h.quantity * h.average_buy_price) AS total_invested_usd,
    SUM(h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) AS total_value_usd,
    (SUM(h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) - SUM(h.quantity * h.average_buy_price)) AS total_pnl_usd,
    -- Converted into User Base Currency:
    SUM(h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) * cr.rate_to_usd AS total_value_base_currency
FROM portfolios p
JOIN users u ON p.user_id = u.user_id
JOIN currency_rates cr ON u.base_currency = cr.currency_code
JOIN holdings h ON p.portfolio_id = h.portfolio_id
LEFT JOIN assets a ON h.symbol = a.symbol
LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
LEFT JOIN price_cache pc ON h.symbol = pc.symbol AND pc.expire_at > CURRENT_TIMESTAMP
WHERE p.portfolio_id = 'p1...'
GROUP BY p.portfolio_id, p.name, u.base_currency, cr.rate_to_usd;
```

### 3.3 Asset Allocation Breakdown (% of Total Portfolio)
```sql
WITH PortfolioValuation AS (
    SELECT 
        h.holding_id,
        h.symbol,
        h.type,
        (h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) AS market_value
    FROM holdings h
    LEFT JOIN assets a ON h.symbol = a.symbol
    LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
    LEFT JOIN price_cache pc ON h.symbol = pc.symbol AND pc.expire_at > CURRENT_TIMESTAMP
    WHERE h.portfolio_id = 'p1...'
),
TotalValuation AS (
    SELECT SUM(market_value) AS total_market_value FROM PortfolioValuation
)
SELECT 
    pv.symbol,
    pv.type,
    pv.market_value,
    ROUND((pv.market_value / NULLIF(tv.total_market_value, 0)) * 100, 2) AS allocation_percentage
FROM PortfolioValuation pv, TotalValuation tv
ORDER BY pv.market_value DESC;
```

### 3.4 Price Alert Trigger Verification
```sql
SELECT 
    al.alert_id,
    al.user_id,
    al.symbol,
    al.threshold,
    al.direction,
    COALESCE(pc.price_usd, ts.price_per_unit) AS current_price,
    u.email
FROM alerts al
JOIN users u ON al.user_id = u.user_id
LEFT JOIN assets a ON al.symbol = a.symbol
LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
LEFT JOIN price_cache pc ON al.symbol = pc.symbol
WHERE al.enabled = TRUE
  AND (
      (al.direction = 'ABOVE' AND COALESCE(pc.price_usd, ts.price_per_unit) >= al.threshold)
      OR
      (al.direction = 'BELOW' AND COALESCE(pc.price_usd, ts.price_per_unit) <= al.threshold)
  );
```
