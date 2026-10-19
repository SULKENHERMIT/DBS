-- ============================================================================
-- SQL SCHEMA DEFINITIONS (DDL)
-- Live Stock & Cryptocurrency Portfolio Management System
-- Compatible with PostgreSQL / Supabase / standard relational DBs
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CURRENCY RATES
CREATE TABLE IF NOT EXISTS currency_rates (
    currency_code VARCHAR(10) PRIMARY KEY,
    rate_to_usd NUMERIC(18, 6) NOT NULL CHECK (rate_to_usd > 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    base_currency VARCHAR(10) DEFAULT 'USD' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_users_currency FOREIGN KEY (base_currency) REFERENCES currency_rates (currency_code) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- 3. EXCHANGES
CREATE TABLE IF NOT EXISTS exchanges (
    exchange_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    url VARCHAR(500)
);

-- 4. ASSETS (POLYMORPHIC CATALOG)
CREATE TABLE IF NOT EXISTS assets (
    asset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('crypto', 'stock')),
    network VARCHAR(100),
    contract_address VARCHAR(255),
    ticker_exchange VARCHAR(50),
    sector VARCHAR(100),
    exchange_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_assets_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges (exchange_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets (symbol);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets (type);

-- 5. TICKER STATS
CREATE TABLE IF NOT EXISTS ticker_stats (
    asset_id UUID PRIMARY KEY,
    price_per_unit NUMERIC(18, 6) NOT NULL DEFAULT 0.0,
    volume_24h NUMERIC(24, 2) DEFAULT 0.0,
    high_24h NUMERIC(18, 6) DEFAULT 0.0,
    low_24h NUMERIC(18, 6) DEFAULT 0.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_ticker_stats_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE CASCADE
);

-- 6. PORTFOLIOS
CREATE TABLE IF NOT EXISTS portfolios (
    portfolio_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_portfolios_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios (user_id);

-- 7. HOLDINGS
CREATE TABLE IF NOT EXISTS holdings (
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

CREATE INDEX IF NOT EXISTS idx_holdings_portfolio_id ON holdings (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings (symbol);

-- 8. TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
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

CREATE INDEX IF NOT EXISTS idx_tx_portfolio_time ON transactions (portfolio_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions (user_id);

-- 9. PORTFOLIO PERFORMANCE
CREATE TABLE IF NOT EXISTS portfolio_performance (
    performance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL,
    total_value NUMERIC(18, 2) NOT NULL,
    total_profit_loss NUMERIC(18, 2) NOT NULL,
    total_profit_loss_pct NUMERIC(8, 4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_perf_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios (portfolio_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_perf_portfolio_time ON portfolio_performance (portfolio_id, timestamp DESC);

-- 10. WATCHLISTS & ITEMS
CREATE TABLE IF NOT EXISTS watchlists (
    watchlist_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    creation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_watchlists_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist_items (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watchlist_id UUID NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    asset_id UUID,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_wl_items_watchlist FOREIGN KEY (watchlist_id) REFERENCES watchlists (watchlist_id) ON DELETE CASCADE,
    CONSTRAINT fk_wl_items_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL,
    CONSTRAINT uq_watchlist_symbol UNIQUE (watchlist_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist ON watchlist_items (watchlist_id);

-- 11. ALERTS & NOTIFICATIONS
CREATE TABLE IF NOT EXISTS alerts (
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

CREATE INDEX IF NOT EXISTS idx_alerts_user_enabled ON alerts (user_id, enabled);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL,
    user_id UUID NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'PUSH', 'IN_APP')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_notif_alert FOREIGN KEY (alert_id) REFERENCES alerts (alert_id) ON DELETE CASCADE,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- 12. PRICE HISTORY
CREATE TABLE IF NOT EXISTS price_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    asset_id UUID,
    price NUMERIC(18, 6) NOT NULL,
    volume NUMERIC(24, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_history_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_sym_time ON price_history (symbol, timestamp DESC);

-- 13. NEWS ARTICLES
CREATE TABLE IF NOT EXISTS news_articles (
    article_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    headline VARCHAR(500) NOT NULL,
    source VARCHAR(100) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS news_article_assets (
    article_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    PRIMARY KEY (article_id, asset_id),
    CONSTRAINT fk_naa_article FOREIGN KEY (article_id) REFERENCES news_articles (article_id) ON DELETE CASCADE,
    CONSTRAINT fk_naa_asset FOREIGN KEY (asset_id) REFERENCES assets (asset_id) ON DELETE CASCADE
);

-- 14. PRICE CACHE
CREATE TABLE IF NOT EXISTS price_cache (
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

CREATE INDEX IF NOT EXISTS idx_price_cache_expire ON price_cache (expire_at);

-- 15. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    action VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_logs (user_id, timestamp DESC);
