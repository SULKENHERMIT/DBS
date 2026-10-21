-- ============================================================================
-- 06_seed_sample_data.sql
-- Live Crypto and Stock Analysis Platform - Baseline Sample Dataset
-- Source of Truth: DA-2 Report (Screenshots 23-28, run_all.sql)
-- Preserves exact sample values, UUIDs, relations, asset catalog, and cache.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CURRENCY RATES
-- ----------------------------------------------------------------------------
INSERT INTO currency_rates (currency_code, rate_to_usd, updated_at) 
VALUES
    ('USD', 1.000000, CURRENT_TIMESTAMP),
    ('EUR', 1.085000, CURRENT_TIMESTAMP),
    ('GBP', 1.270000, CURRENT_TIMESTAMP),
    ('JPY', 0.006500, CURRENT_TIMESTAMP),
    ('CAD', 0.740000, CURRENT_TIMESTAMP),
    ('AUD', 0.655000, CURRENT_TIMESTAMP)
ON CONFLICT (currency_code) DO UPDATE 
SET rate_to_usd = EXCLUDED.rate_to_usd, 
    updated_at = CURRENT_TIMESTAMP;

-- ----------------------------------------------------------------------------
-- 2. USERS
-- ----------------------------------------------------------------------------
INSERT INTO users (user_id, email, password_hash, base_currency, created_at) 
VALUES
    ('00000000-0000-0000-0000-000000000001', 'investor@example.com', '$2b$12$e8uqQ0A9aZ4cx5Gy7z8uOuIT7h0jk01lm2n3o4p5q6r7s8', 'USD', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000002', 'crypto_trader@example.com', '$2b$12$e8uqQ0A9aZ4cx5Gy7z8uOuIT7h0jk01lm2n3o4p5q6r7s8', 'EUR', CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000003', 'tech_analyst@example.com', '$2b$12$e8uqQ0A9aZ4cx5Gy7z8uOuIT7h0jk01lm2n3o4p5q6r7s8', 'GBP', CURRENT_TIMESTAMP)
ON CONFLICT (user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. EXCHANGES
-- ----------------------------------------------------------------------------
INSERT INTO exchanges (exchange_id, name, country, url) 
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Binance Global', 'Malta', 'https://www.binance.com'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Coinbase Exchange', 'United States', 'https://www.coinbase.com'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'NASDAQ Stock Market', 'United States', 'https://www.nasdaq.com'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'New York Stock Exchange (NYSE)', 'United States', 'https://www.nyse.com')
ON CONFLICT (exchange_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. ASSETS (Polymorphic Catalog for Crypto & Stocks)
-- ----------------------------------------------------------------------------
INSERT INTO assets (asset_id, symbol, name, type, network, contract_address, ticker_exchange, sector, exchange_id, created_at) 
VALUES
    ('22222222-2222-2222-2222-222222222221', 'BTC', 'Bitcoin Core', 'crypto', 'Bitcoin Core', NULL, NULL, NULL, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222222', 'ETH', 'Ethereum', 'crypto', 'Ethereum Mainnet', '0x0000000000000000000000000000000000000000', NULL, NULL, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222224', 'SOL', 'Solana', 'crypto', 'Solana Mainnet-Beta', NULL, NULL, NULL, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222225', 'AAPL', 'Apple Inc.', 'stock', NULL, NULL, 'NASDAQ', 'Consumer Electronics', 'cccccccc-cccc-cccc-cccc-cccccccccccc', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222226', 'NVDA', 'NVIDIA Corporation', 'stock', NULL, NULL, 'NASDAQ', 'Semiconductors & AI Hardware', 'cccccccc-cccc-cccc-cccc-cccccccccccc', CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222227', 'TSLA', 'Tesla Inc.', 'stock', NULL, NULL, 'NASDAQ', 'Automotive & Clean Tech', 'cccccccc-cccc-cccc-cccc-cccccccccccc', CURRENT_TIMESTAMP)
ON CONFLICT (asset_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. TICKER STATS (24h Market Overview)
-- ----------------------------------------------------------------------------
INSERT INTO ticker_stats (asset_id, price_per_unit, volume_24h, high_24h, low_24h, updated_at) 
VALUES
    ('22222222-2222-2222-2222-222222222221', 64500.000000, 28500000.00, 65800.000000, 63200.000000, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222222', 3450.000000, 16200000.00, 3590.000000, 3310.000000, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222224', 148.500000, 4200000.00, 152.000000, 134.000000, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222225', 228.750000, 58000000.00, 231.500000, 221.500000, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222226', 124.500000, 94000000.00, 128.000000, 117.000000, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222227', 242.100000, 61000000.00, 245.500000, 240.000000, CURRENT_TIMESTAMP)
ON CONFLICT (asset_id) DO UPDATE 
SET price_per_unit = EXCLUDED.price_per_unit,
    volume_24h = EXCLUDED.volume_24h,
    high_24h = EXCLUDED.high_24h,
    low_24h = EXCLUDED.low_24h,
    updated_at = CURRENT_TIMESTAMP;

-- ----------------------------------------------------------------------------
-- 6. PORTFOLIOS
-- ----------------------------------------------------------------------------
INSERT INTO portfolios (portfolio_id, user_id, name, created_at) 
VALUES
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Growth & Multi-Asset Fund', CURRENT_TIMESTAMP),
    ('11111111-1111-1111-1111-111111111112', '00000000-0000-0000-0000-000000000001', 'Long Term Cold Storage', CURRENT_TIMESTAMP),
    ('11111111-1111-1111-1111-111111111113', '00000000-0000-0000-0000-000000000002', 'High Beta Crypto-Portfolio', CURRENT_TIMESTAMP)
ON CONFLICT (portfolio_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. HOLDINGS
-- ----------------------------------------------------------------------------
INSERT INTO holdings (holding_id, portfolio_id, asset_id, symbol, name, type, quantity, average_buy_price, updated_at) 
VALUES
    ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'BTC', 'Bitcoin Core', 'crypto', 1.25000000, 58200.000000, CURRENT_TIMESTAMP),
    ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'ETH', 'Ethereum', 'crypto', 8.50000000, 3100.000000, CURRENT_TIMESTAMP),
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222225', 'AAPL', 'Apple Inc.', 'stock', 50.00000000, 210.000000, CURRENT_TIMESTAMP),
    ('33333333-3333-3333-3333-333333333334', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222226', 'NVDA', 'NVIDIA Corporation', 'stock', 80.00000000, 105.500000, CURRENT_TIMESTAMP)
ON CONFLICT (portfolio_id, symbol) DO UPDATE 
SET quantity = EXCLUDED.quantity, 
    average_buy_price = EXCLUDED.average_buy_price, 
    updated_at = CURRENT_TIMESTAMP;

-- ----------------------------------------------------------------------------
-- 8. TRANSACTIONS
-- ----------------------------------------------------------------------------
INSERT INTO transactions (transaction_id, user_id, portfolio_id, asset_id, symbol, type, quantity, price_at_transaction, network_hash, timestamp) 
VALUES
    ('55555555-5555-5555-5555-555555555551', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 'BTC', 'BUY', 1.25000000, 58200.000000, NULL, CURRENT_TIMESTAMP - INTERVAL '30 days'),
    ('55555555-5555-5555-5555-555555555552', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'ETH', 'BUY', 8.50000000, 3100.000000, NULL, CURRENT_TIMESTAMP - INTERVAL '20 days'),
    ('55555555-5555-5555-5555-555555555553', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222225', 'AAPL', 'BUY', 50.00000000, 210.000000, NULL, CURRENT_TIMESTAMP - INTERVAL '15 days'),
    ('55555555-5555-5555-5555-555555555554', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222226', 'NVDA', 'BUY', 80.00000000, 105.500000, NULL, CURRENT_TIMESTAMP - INTERVAL '10 days')
ON CONFLICT (transaction_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 9. PORTFOLIO PERFORMANCE
-- ----------------------------------------------------------------------------
INSERT INTO portfolio_performance (performance_id, portfolio_id, total_value, total_profit_loss, total_profit_loss_pct, timestamp) 
VALUES
    ('66666666-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111', 121500.00, 14200.00, 13.2340, CURRENT_TIMESTAMP - INTERVAL '14 days'),
    ('66666666-6666-6666-6666-666666666662', '11111111-1111-1111-1111-111111111111', 126800.00, 19500.00, 18.1733, CURRENT_TIMESTAMP - INTERVAL '7 days'),
    ('66666666-6666-6666-6666-666666666663', '11111111-1111-1111-1111-111111111111', 129850.00, 22550.00, 21.0150, CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('66666666-6666-6666-6666-666666666664', '11111111-1111-1111-1111-111111111111', 131347.50, 24097.50, 22.4578, CURRENT_TIMESTAMP)
ON CONFLICT (performance_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 10. WATCHLISTS
-- ----------------------------------------------------------------------------
INSERT INTO watchlists (watchlist_id, user_id, name, creation_date) 
VALUES
    ('77777777-7777-7777-7777-777777777771', '00000000-0000-0000-0000-000000000001', 'Core Tech & Layer 1s', CURRENT_TIMESTAMP),
    ('77777777-7777-7777-7777-777777777772', '00000000-0000-0000-0000-000000000002', 'DeFi Breakouts', CURRENT_TIMESTAMP)
ON CONFLICT (watchlist_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 11. WATCHLIST ITEMS
-- ----------------------------------------------------------------------------
INSERT INTO watchlist_items (item_id, watchlist_id, symbol, asset_id, added_at) 
VALUES
    ('88888888-8888-8888-8888-888888888881', '77777777-7777-7777-7777-777777777771', 'BTC', '22222222-2222-2222-2222-222222222221', CURRENT_TIMESTAMP),
    ('88888888-8888-8888-8888-888888888882', '77777777-7777-7777-7777-777777777771', 'ETH', '22222222-2222-2222-2222-222222222222', CURRENT_TIMESTAMP),
    ('88888888-8888-8888-8888-888888888883', '77777777-7777-7777-7777-777777777771', 'NVDA', '22222222-2222-2222-2222-222222222226', CURRENT_TIMESTAMP),
    ('88888888-8888-8888-8888-888888888884', '77777777-7777-7777-7777-777777777772', 'SOL', '22222222-2222-2222-2222-222222222224', CURRENT_TIMESTAMP)
ON CONFLICT (watchlist_id, symbol) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 12. ALERTS
-- ----------------------------------------------------------------------------
INSERT INTO alerts (alert_id, user_id, symbol, asset_id, threshold, direction, enabled, triggered_at, created_at) 
VALUES
    ('44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000001', 'BTC', '22222222-2222-2222-2222-222222222221', 65000.000000, 'ABOVE', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-444444444442', '00000000-0000-0000-0000-000000000001', 'ETH', '22222222-2222-2222-2222-222222222222', 3200.000000, 'BELOW', TRUE, NULL, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-444444444443', '00000000-0000-0000-0000-000000000001', 'NVDA', '22222222-2222-2222-2222-222222222226', 125.000000, 'ABOVE', TRUE, NULL, CURRENT_TIMESTAMP),
    ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000002', 'TSLA', '22222222-2222-2222-2222-222222222227', 220.000000, 'BELOW', TRUE, NULL, CURRENT_TIMESTAMP)
ON CONFLICT (alert_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 13. NOTIFICATIONS
-- ----------------------------------------------------------------------------
INSERT INTO notifications (notification_id, alert_id, user_id, channel, status, sent_at) 
VALUES
    ('99999999-9999-9999-9999-999999999991', '44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000001', 'EMAIL', 'SENT', CURRENT_TIMESTAMP),
    ('99999999-9999-9999-9999-999999999992', '44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000001', 'IN_APP', 'SENT', CURRENT_TIMESTAMP)
ON CONFLICT (notification_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 14. PRICE HISTORY (Baseline records from DA-2 report)
-- ----------------------------------------------------------------------------
INSERT INTO price_history (history_id, symbol, asset_id, price, volume, timestamp) 
VALUES
    -- Bitcoin (BTC)
    (uuid_generate_v4(), 'BTC', '22222222-2222-2222-2222-222222222221', 63850.000000, 48500000.00, CURRENT_TIMESTAMP - INTERVAL '18 hours'),
    (uuid_generate_v4(), 'BTC', '22222222-2222-2222-2222-222222222221', 64200.000000, 62000000.00, CURRENT_TIMESTAMP - INTERVAL '12 hours'),
    (uuid_generate_v4(), 'BTC', '22222222-2222-2222-2222-222222222221', 65200.000000, 91000000.00, CURRENT_TIMESTAMP - INTERVAL '6 hours'),
    (uuid_generate_v4(), 'BTC', '22222222-2222-2222-2222-222222222221', 64500.000000, 51000000.00, CURRENT_TIMESTAMP - INTERVAL '1 hour'),
    -- Ethereum (ETH)
    (uuid_generate_v4(), 'ETH', '22222222-2222-2222-2222-222222222222', 3390.000000, 21000000.00, CURRENT_TIMESTAMP - INTERVAL '16 hours'),
    (uuid_generate_v4(), 'ETH', '22222222-2222-2222-2222-222222222222', 3480.000000, 32000000.00, CURRENT_TIMESTAMP - INTERVAL '8 hours'),
    (uuid_generate_v4(), 'ETH', '22222222-2222-2222-2222-222222222222', 3450.000000, 19000000.00, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
    -- NVIDIA (NVDA)
    (uuid_generate_v4(), 'NVDA', '22222222-2222-2222-2222-222222222226', 121.200000, 85000000.00, CURRENT_TIMESTAMP - INTERVAL '20 hours'),
    (uuid_generate_v4(), 'NVDA', '22222222-2222-2222-2222-222222222226', 127.800000, 110000000.00, CURRENT_TIMESTAMP - INTERVAL '10 hours'),
    (uuid_generate_v4(), 'NVDA', '22222222-2222-2222-2222-222222222226', 124.500000, 72000000.00, CURRENT_TIMESTAMP - INTERVAL '3 hours');

-- ----------------------------------------------------------------------------
-- 15. NEWS ARTICLES
-- ----------------------------------------------------------------------------
INSERT INTO news_articles (article_id, headline, source, url, published_at) 
VALUES
    ('abababab-abab-abab-abab-abababababab', 'Bitcoin Surpasses Key Resistance as Institutional Inflows Surge', 'Bloomberg Crypto', 'https://bloomberg.com/crypto/btc-inflows', CURRENT_TIMESTAMP - INTERVAL '14 hours'),
    ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', 'NVIDIA Unveils Next-Generation Blackwell Ultra AI Superchips', 'TechCrunch', 'https://techcrunch.com/nvda-blackwell', CURRENT_TIMESTAMP - INTERVAL '8 hours'),
    ('efefefef-efef-efef-efef-efefefefefef', 'Apple Expands On-Device AI Intelligence Architecture to Global Markets', 'Reuters Business', 'https://reuters.com/aapl-ai-architecture', CURRENT_TIMESTAMP - INTERVAL '4 hours')
ON CONFLICT (article_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 16. NEWS ARTICLE ASSETS
-- ----------------------------------------------------------------------------
INSERT INTO news_article_assets (article_id, asset_id) 
VALUES
    ('abababab-abab-abab-abab-abababababab', '22222222-2222-2222-2222-222222222221'),
    ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', '22222222-2222-2222-2222-222222222226'),
    ('efefefef-efef-efef-efef-efefefefefef', '22222222-2222-2222-2222-222222222225')
ON CONFLICT (article_id, asset_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 17. PRICE CACHE
-- ----------------------------------------------------------------------------
INSERT INTO price_cache (cache_id, symbol, asset_type, price_usd, high_24h, low_24h, volume_24h, change_24h, fetched_at, expire_at, metadata) 
VALUES
    (uuid_generate_v4(), 'BTC', 'crypto', 64500.000000, 65200.000000, 63800.000000, 28500000.00, 2.1500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', '{"source": "CoinGecko API"}'::JSONB),
    (uuid_generate_v4(), 'ETH', 'crypto', 3450.000000, 3510.000000, 3390.000000, 16200000.00, 1.4500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', '{"source": "CoinGecko API"}'::JSONB),
    (uuid_generate_v4(), 'NVDA', 'stock', 124.500000, 127.800000, 121.200000, 94000000.00, 3.2500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', '{"source": "Finnhub API"}'::JSONB),
    (uuid_generate_v4(), 'AAPL', 'stock', 228.750000, 231.500000, 226.100000, 58000000.00, 0.9500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes', '{"source": "Finnhub API"}'::JSONB),
    (uuid_generate_v4(), 'DOGE', 'crypto', 0.125000, 0.132000, 0.121000, 120000000.00, -1.2000, CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP - INTERVAL '10 minutes', '{"source": "CoinGecko API"}'::JSONB)
ON CONFLICT (symbol, asset_type) DO UPDATE 
SET price_usd = EXCLUDED.price_usd,
    high_24h = EXCLUDED.high_24h,
    low_24h = EXCLUDED.low_24h,
    volume_24h = EXCLUDED.volume_24h,
    change_24h = EXCLUDED.change_24h,
    fetched_at = EXCLUDED.fetched_at,
    expire_at = EXCLUDED.expire_at,
    metadata = EXCLUDED.metadata;

-- ----------------------------------------------------------------------------
-- 18. AUDIT LOGS
-- ----------------------------------------------------------------------------
INSERT INTO audit_logs (log_id, user_id, action, timestamp) 
VALUES
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'USER_SIGNUP', CURRENT_TIMESTAMP - INTERVAL '60 days'),
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'PORTFOLIO_CREATED: Growth & Multi-Asset Fund', CURRENT_TIMESTAMP - INTERVAL '45 days'),
    (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'USER_LOGIN: IP 192.168.1.100', CURRENT_TIMESTAMP - INTERVAL '2 hours');
