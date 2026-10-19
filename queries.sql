-- ============================================================================
-- SQL QUERIES & ANALYTICAL OPERATIONS
-- Live Stock & Cryptocurrency Portfolio Management System
-- ============================================================================

-- ============================================================================
-- 1. AUTHENTICATION & USER MANAGEMENT
-- ============================================================================

-- Insert New User (Signup)
INSERT INTO users (email, password_hash, base_currency)
VALUES ('investor@example.com', '$2b$12$e8uq...', 'USD')
RETURNING user_id, email, base_currency, created_at;

-- Authenticate User (Login Check)
SELECT user_id, email, password_hash, base_currency, created_at
FROM users
WHERE email = 'investor@example.com';

-- Update User Base Currency
UPDATE users
SET base_currency = 'EUR'
WHERE user_id = '00000000-0000-0000-0000-000000000001';


-- ============================================================================
-- 2. PORTFOLIO CRUD OPERATIONS
-- ============================================================================

-- Create Portfolio
INSERT INTO portfolios (user_id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Tech Growth Portfolio')
RETURNING portfolio_id, user_id, name, created_at;

-- List All Portfolios for a User (with total position counts)
SELECT 
    p.portfolio_id,
    p.name,
    p.created_at,
    COUNT(h.holding_id) AS total_positions
FROM portfolios p
LEFT JOIN holdings h ON p.portfolio_id = h.portfolio_id
WHERE p.user_id = '00000000-0000-0000-0000-000000000001'
GROUP BY p.portfolio_id, p.name, p.created_at
ORDER BY p.created_at DESC;

-- Get Single Portfolio Details
SELECT portfolio_id, user_id, name, created_at
FROM portfolios
WHERE portfolio_id = '11111111-1111-1111-1111-111111111111' 
  AND user_id = '00000000-0000-0000-0000-000000000001';

-- Rename Portfolio
UPDATE portfolios
SET name = 'Core Retirement Portfolio'
WHERE portfolio_id = '11111111-1111-1111-1111-111111111111' 
  AND user_id = '00000000-0000-0000-0000-000000000001';

-- Delete Portfolio
DELETE FROM portfolios
WHERE portfolio_id = '11111111-1111-1111-1111-111111111111' 
  AND user_id = '00000000-0000-0000-0000-000000000001';


-- ============================================================================
-- 3. HOLDINGS MANAGEMENT (UPSERT & POSITIONS)
-- ============================================================================

-- Add or Accumulate Holding (Automatic Weighted Average Cost Basis)
INSERT INTO holdings (portfolio_id, asset_id, symbol, name, type, quantity, average_buy_price)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'BTC',
    'Bitcoin',
    'crypto',
    0.75,
    62000.00
)
ON CONFLICT (portfolio_id, symbol)
DO UPDATE SET 
    quantity = holdings.quantity + EXCLUDED.quantity,
    average_buy_price = ((holdings.quantity * holdings.average_buy_price) + (EXCLUDED.quantity * EXCLUDED.average_buy_price)) / (holdings.quantity + EXCLUDED.quantity),
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- List All Holdings in a Portfolio
SELECT 
    holding_id,
    portfolio_id,
    symbol,
    name,
    type,
    quantity,
    average_buy_price,
    updated_at
FROM holdings
WHERE portfolio_id = '11111111-1111-1111-1111-111111111111'
ORDER BY symbol ASC;

-- Update Specific Holding
UPDATE holdings
SET quantity = 1.25, average_buy_price = 61500.00, updated_at = CURRENT_TIMESTAMP
WHERE holding_id = '33333333-3333-3333-3333-333333333333'
  AND portfolio_id = '11111111-1111-1111-1111-111111111111';

-- Delete Holding
DELETE FROM holdings
WHERE holding_id = '33333333-3333-3333-3333-333333333333'
  AND portfolio_id = '11111111-1111-1111-1111-111111111111';


-- ============================================================================
-- 4. TRANSACTIONS & TRADE LOGGING
-- ============================================================================

-- Record Trade Execution
INSERT INTO transactions (user_id, portfolio_id, asset_id, symbol, type, quantity, price_at_transaction, network_hash)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'NVDA',
    'BUY',
    20.0,
    125.50,
    NULL
)
RETURNING transaction_id, timestamp;

-- Fetch Paginated Transaction History for a Portfolio
SELECT 
    t.transaction_id,
    t.symbol,
    t.type,
    t.quantity,
    t.price_at_transaction,
    (t.quantity * t.price_at_transaction) AS total_amount,
    t.network_hash,
    t.timestamp
FROM transactions t
WHERE t.portfolio_id = '11111111-1111-1111-1111-111111111111'
ORDER BY t.timestamp DESC
LIMIT 50 OFFSET 0;


-- ============================================================================
-- 5. REAL-TIME VALUATION & ANALYTICAL SQL QUERIES
-- ============================================================================

-- 5.1 Real-Time Holdings Valuation with Unrealized Gain/Loss
SELECT 
    h.holding_id,
    h.symbol,
    h.name,
    h.type,
    h.quantity,
    h.average_buy_price,
    (h.quantity * h.average_buy_price) AS total_invested,
    COALESCE(pc.price_usd, ts.price_per_unit, 0) AS current_price,
    (h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) AS current_value,
    ((h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) - (h.quantity * h.average_buy_price)) AS gain_loss,
    CASE 
        WHEN (h.quantity * h.average_buy_price) > 0 
        THEN (((h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) - (h.quantity * h.average_buy_price)) / (h.quantity * h.average_buy_price)) * 100 
        ELSE 0 
    END AS gain_loss_pct
FROM holdings h
LEFT JOIN assets a ON h.symbol = a.symbol
LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
LEFT JOIN price_cache pc ON h.symbol = pc.symbol AND pc.expire_at > CURRENT_TIMESTAMP
WHERE h.portfolio_id = '11111111-1111-1111-1111-111111111111'
ORDER BY current_value DESC;

-- 5.2 Portfolio Total Aggregate Value and Converted Base Currency Net Worth
SELECT 
    p.portfolio_id,
    p.name AS portfolio_name,
    u.base_currency,
    cr.rate_to_usd,
    SUM(h.quantity * h.average_buy_price) AS total_cost_usd,
    SUM(h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) AS total_market_value_usd,
    (SUM(h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) - SUM(h.quantity * h.average_buy_price)) AS total_unrealized_pnl_usd,
    CASE 
        WHEN SUM(h.quantity * h.average_buy_price) > 0 
        THEN ((SUM(h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) - SUM(h.quantity * h.average_buy_price)) / SUM(h.quantity * h.average_buy_price)) * 100 
        ELSE 0 
    END AS total_unrealized_pnl_pct,
    -- Valuation converted to user base currency
    SUM(h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) * cr.rate_to_usd AS total_value_base_currency
FROM portfolios p
JOIN users u ON p.user_id = u.user_id
JOIN currency_rates cr ON u.base_currency = cr.currency_code
JOIN holdings h ON p.portfolio_id = h.portfolio_id
LEFT JOIN assets a ON h.symbol = a.symbol
LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
LEFT JOIN price_cache pc ON h.symbol = pc.symbol AND pc.expire_at > CURRENT_TIMESTAMP
WHERE p.portfolio_id = '11111111-1111-1111-1111-111111111111'
GROUP BY p.portfolio_id, p.name, u.base_currency, cr.rate_to_usd;

-- 5.3 Asset Class Allocation (Crypto vs Stock Breakdown)
WITH PositionValues AS (
    SELECT 
        h.type,
        SUM(h.quantity * COALESCE(pc.price_usd, ts.price_per_unit, 0)) AS class_value
    FROM holdings h
    LEFT JOIN assets a ON h.symbol = a.symbol
    LEFT JOIN ticker_stats ts ON a.asset_id = ts.asset_id
    LEFT JOIN price_cache pc ON h.symbol = pc.symbol AND pc.expire_at > CURRENT_TIMESTAMP
    WHERE h.portfolio_id = '11111111-1111-1111-1111-111111111111'
    GROUP BY h.type
),
TotalValue AS (
    SELECT SUM(class_value) AS grand_total FROM PositionValues
)
SELECT 
    pv.type AS asset_class,
    pv.class_value,
    ROUND((pv.class_value / NULLIF(tv.grand_total, 0)) * 100, 2) AS allocation_percentage
FROM PositionValues pv, TotalValue tv;


-- ============================================================================
-- 6. ALERTS & NOTIFICATION DISPATCH
-- ============================================================================

-- Check for Triggered Alerts
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

-- Record Notification Log & Mark Alert Triggered
INSERT INTO notifications (alert_id, user_id, channel, status)
VALUES ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'EMAIL', 'SENT');

UPDATE alerts
SET triggered_at = CURRENT_TIMESTAMP, enabled = FALSE
WHERE alert_id = '44444444-4444-4444-4444-444444444444';
