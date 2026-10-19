# Live Stock & Crypto Portfolio Management API Reference

Base URL: `http://127.0.0.1:8000`  
Interactive Swagger Documentation: `http://127.0.0.1:8000/docs`  
OpenAPI Specification: `http://127.0.0.1:8000/openapi.json`

---

## Table of Contents
1. [Authentication & User Management](#1-authentication--user-management)
2. [Portfolios](#2-portfolios)
3. [Holdings & Live Valuation](#3-holdings--live-valuation)
4. [Assets & Live Quotes](#4-assets--live-quotes)
5. [Transactions](#5-transactions)
6. [Watchlists](#6-watchlists)
7. [Alerts & Notifications](#7-alerts--notifications)
8. [Portfolio Performance](#8-portfolio-performance)
9. [Market & Reference Data](#9-market--reference-data)
10. [Health & System](#10-health--system)

---

## 1. Authentication & User Management

### `POST /auth/signup`
Create a new user account with bcrypt password hashing.

- **Auth Required**: No
- **Request Body**:
```json
{
  "email": "trader@example.com",
  "password": "SecurePassword123!",
  "base_currency": "USD"
}
```
- **Response (`201 Created`)**:
```json
{
  "_id": "6a81b57780a47475f41c0a51",
  "email": "trader@example.com",
  "base_currency": "USD",
  "created_at": "2026-08-16T13:04:55.191296Z"
}
```

---

### `POST /auth/login`
Authenticate user credentials and receive a JWT Bearer token.

- **Auth Required**: No
- **Request Body**:
```json
{
  "email": "trader@example.com",
  "password": "SecurePassword123!"
}
```
- **Response (`200 OK`)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "_id": "6a81b57780a47475f41c0a51",
    "email": "trader@example.com",
    "base_currency": "USD",
    "created_at": "2026-08-16T13:04:55.191000"
  }
}
```

---

### `GET /auth/me`
Retrieve the authenticated user's profile.

- **Auth Required**: `Bearer <token>`
- **Response (`200 OK`)**:
```json
{
  "_id": "6a81b57780a47475f41c0a51",
  "email": "trader@example.com",
  "base_currency": "USD",
  "created_at": "2026-08-16T13:04:55.191000"
}
```

---

## 2. Portfolios

### `POST /portfolios`
Create a new portfolio owned by the current user.

- **Auth Required**: `Bearer <token>`
- **Request Body**:
```json
{
  "name": "Global Growth Portfolio"
}
```
- **Response (`201 Created`)**:
```json
{
  "_id": "6a81b57780a47475f41c0a54",
  "user_id": "6a81b57780a47475f41c0a51",
  "name": "Global Growth Portfolio",
  "created_at": "2026-08-16T13:04:55.863487Z",
  "holdings": []
}
```

---

### `GET /portfolios`
List all portfolios belonging to the authenticated user.

- **Auth Required**: `Bearer <token>`
- **Response (`200 OK`)**:
```json
[
  {
    "_id": "6a81b57780a47475f41c0a54",
    "user_id": "6a81b57780a47475f41c0a51",
    "name": "Global Growth Portfolio",
    "created_at": "2026-08-16T13:04:55.863487Z",
    "holdings": [
      {
        "_id": "6a81b57780a47475f41c0a56",
        "symbol": "BTC",
        "name": "Bitcoin",
        "type": "crypto",
        "quantity": 0.85,
        "average_buy_price": 59500.0,
        "asset_id": null,
        "updated_at": "2026-08-16T13:04:55.985974Z"
      }
    ]
  }
]
```

---

### `GET /portfolios/{portfolio_id}`
Retrieve single portfolio by ID (scoped to owner).

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string)
- **Response (`200 OK`)**:
```json
{
  "_id": "6a81b57780a47475f41c0a54",
  "user_id": "6a81b57780a47475f41c0a51",
  "name": "Global Growth Portfolio",
  "created_at": "2026-08-16T13:04:55.863487Z",
  "holdings": []
}
```

---

### `PUT /portfolios/{portfolio_id}`
Update portfolio name.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string)
- **Request Body**:
```json
{
  "name": "Updated Portfolio Name"
}
```
- **Response (`200 OK`)**:
```json
{
  "_id": "6a81b57780a47475f41c0a54",
  "user_id": "6a81b57780a47475f41c0a51",
  "name": "Updated Portfolio Name",
  "created_at": "2026-08-16T13:04:55.863487Z",
  "holdings": []
}
```

---

### `DELETE /portfolios/{portfolio_id}`
Delete portfolio and associated sub-resources.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string)
- **Response (`204 No Content`)**

---

### `GET /portfolios/{portfolio_id}/valuation`
Compute total market valuation and aggregate profit/loss across all holdings using live/cached prices.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string)
- **Response (`200 OK`)**:
```json
{
  "portfolio_id": "6a81b57780a47475f41c0a54",
  "portfolio_name": "Global Growth Portfolio",
  "total_invested": 54875.0,
  "total_current_value": 59638.85,
  "total_gain_loss": 4763.85,
  "total_gain_loss_pct": 8.68,
  "holdings_valuation": [
    {
      "id": "6a81b57780a47475f41c0a56",
      "symbol": "BTC",
      "name": "Bitcoin",
      "type": "crypto",
      "quantity": 0.85,
      "average_buy_price": 59500.0,
      "total_invested": 50575.0,
      "current_price": 62965.0,
      "current_value": 53520.25,
      "gain_loss": 2945.25,
      "gain_loss_pct": 5.82,
      "price_source": "CoinGecko",
      "cached": true,
      "price_updated_at": "2026-08-16T13:01:33.160000"
    }
  ]
}
```

---

## 3. Holdings & Live Valuation

### `POST /portfolios/{portfolio_id}/holdings`
Add a cryptocurrency or stock holding into the portfolio document.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string)
- **Request Body**:
```json
{
  "symbol": "BTC",
  "name": "Bitcoin",
  "type": "crypto",
  "quantity": 0.85,
  "average_buy_price": 59500.0,
  "asset_id": null
}
```
- **Response (`201 Created`)**:
```json
{
  "_id": "6a81b57780a47475f41c0a56",
  "symbol": "BTC",
  "name": "Bitcoin",
  "type": "crypto",
  "quantity": 0.85,
  "average_buy_price": 59500.0,
  "asset_id": null,
  "updated_at": "2026-08-16T13:04:55.985974Z"
}
```

---

### `GET /portfolios/{portfolio_id}/holdings`
List all holdings within a portfolio.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string)
- **Response (`200 OK`)**:
```json
[
  {
    "_id": "6a81b57780a47475f41c0a56",
    "symbol": "BTC",
    "name": "Bitcoin",
    "type": "crypto",
    "quantity": 0.85,
    "average_buy_price": 59500.0,
    "asset_id": null,
    "updated_at": "2026-08-16T13:04:55.985974Z"
  }
]
```

---

### `GET /portfolios/{portfolio_id}/holdings/{holding_id}`
Retrieve a specific holding by holding ID.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string), `holding_id` (string)
- **Response (`200 OK`)**:
```json
{
  "_id": "6a81b57780a47475f41c0a56",
  "symbol": "BTC",
  "name": "Bitcoin",
  "type": "crypto",
  "quantity": 0.85,
  "average_buy_price": 59500.0,
  "asset_id": null,
  "updated_at": "2026-08-16T13:04:55.985974Z"
}
```

---

### `PUT /portfolios/{portfolio_id}/holdings/{holding_id}`
Update holding quantity, average buy price, or display name.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string), `holding_id` (string)
- **Request Body**:
```json
{
  "quantity": 1.25,
  "average_buy_price": 58000.0
}
```
- **Response (`200 OK`)**:
```json
{
  "_id": "6a81b57780a47475f41c0a56",
  "symbol": "BTC",
  "name": "Bitcoin",
  "type": "crypto",
  "quantity": 1.25,
  "average_buy_price": 58000.0,
  "asset_id": null,
  "updated_at": "2026-08-16T13:10:00.000000Z"
}
```

---

### `DELETE /portfolios/{portfolio_id}/holdings/{holding_id}`
Remove a holding from the portfolio.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string), `holding_id` (string)
- **Response (`204 No Content`)**

---

### `GET /portfolios/{portfolio_id}/holdings/{holding_id}/valuation`
Compute live valuation and gain/loss using live prices (CoinGecko for crypto, Finnhub for stocks, cached in MongoDB `PriceCache` for 5 minutes).

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string), `holding_id` (string)
- **Response (`200 OK`)**:
```json
{
  "id": "6a81b57780a47475f41c0a56",
  "symbol": "BTC",
  "name": "Bitcoin",
  "type": "crypto",
  "quantity": 0.85,
  "average_buy_price": 59500.0,
  "total_invested": 50575.0,
  "current_price": 62965.0,
  "current_value": 53520.25,
  "gain_loss": 2945.25,
  "gain_loss_pct": 5.82,
  "price_source": "CoinGecko",
  "cached": true,
  "price_updated_at": "2026-08-16T13:01:33.160000"
}
```

---

## 4. Assets & Live Quotes

### `POST /assets`
Register an asset in the catalog (supporting crypto or stock specializations).

- **Auth Required**: `Bearer <token>`
- **Request Body (Stock Example)**:
```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "type": "stock",
  "ticker_exchange": "NASDAQ",
  "sector": "Technology"
}
```
- **Response (`201 Created`)**:
```json
{
  "_id": "6a81b57780a47475f41c0a60",
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "type": "stock",
  "ticker_exchange": "NASDAQ",
  "sector": "Technology",
  "created_at": "2026-08-16T13:05:00.000000Z"
}
```

---

### `GET /assets`
Search and list assets from catalog.

- **Auth Required**: `Bearer <token>`
- **Query Parameters**:
  - `type` (optional string): `"crypto"` or `"stock"`
  - `search` (optional string): query text
- **Response (`200 OK`)**:
```json
[
  {
    "_id": "6a81b57780a47475f41c0a60",
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "type": "stock",
    "ticker_exchange": "NASDAQ",
    "sector": "Technology"
  }
]
```

---

### `GET /assets/{symbol}`
Get asset information by ticker symbol.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `symbol` (string)
- **Response (`200 OK`)**:
```json
{
  "_id": "6a81b57780a47475f41c0a60",
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "type": "stock",
  "ticker_exchange": "NASDAQ",
  "sector": "Technology"
}
```

---

### `GET /assets/{symbol}/quote`
Fetch a live cached quote for any symbol.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `symbol` (string)
- **Query Parameters**: `asset_type` (`"crypto"` or `"stock"`)
- **Response (`200 OK`)**:
```json
{
  "symbol": "AAPL",
  "asset_type": "stock",
  "price": 305.93,
  "high_24h": 307.49,
  "low_24h": 304.3,
  "volume_24h": null,
  "change_24h": 0.2195,
  "source": "Finnhub",
  "cached": true,
  "fetched_at": "2026-08-16T13:01:33.780000"
}
```

---

## 5. Transactions

### `POST /transactions`
Record a trade/transfer transaction for a portfolio.

- **Auth Required**: `Bearer <token>`
- **Request Body**:
```json
{
  "portfolio_id": "6a81b57780a47475f41c0a54",
  "symbol": "BTC",
  "type": "BUY",
  "quantity": 0.85,
  "price_at_transaction": 59500.0,
  "network_hash": "0x4a8b...7f1c"
}
```
- **Response (`201 Created`)**:
```json
{
  "_id": "6a81b57880a47475f41c0a72",
  "user_id": "6a81b57780a47475f41c0a51",
  "portfolio_id": "6a81b57780a47475f41c0a54",
  "symbol": "BTC",
  "type": "BUY",
  "quantity": 0.85,
  "price_at_transaction": 59500.0,
  "network_hash": "0x4a8b...7f1c",
  "timestamp": "2026-08-16T13:05:30.000000Z"
}
```

---

### `GET /transactions`
List user transactions with optional filters.

- **Auth Required**: `Bearer <token>`
- **Query Parameters**:
  - `portfolio_id` (optional string)
  - `symbol` (optional string)
- **Response (`200 OK`)**: Array of transaction objects.

---

## 6. Watchlists

### `POST /watchlists`
Create a watchlist.

- **Auth Required**: `Bearer <token>`
- **Request Body**:
```json
{
  "name": "DeFi & Large Cap Tech"
}
```
- **Response (`201 Created`)**:
```json
{
  "_id": "6a81b57880a47475f41c0a80",
  "user_id": "6a81b57780a47475f41c0a51",
  "name": "DeFi & Large Cap Tech",
  "creation_date": "2026-08-16T13:06:00.000000Z",
  "items": []
}
```

---

### `GET /watchlists`
List all user watchlists.

- **Auth Required**: `Bearer <token>`
- **Response (`200 OK`)**: Array of watchlist objects with embedded items.

---

### `POST /watchlists/{watchlist_id}/items`
Add an asset symbol to a watchlist.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `watchlist_id` (string)
- **Query Parameters**: `symbol` (string, e.g. `ETH`)
- **Response (`200 OK`)**: Updated watchlist JSON.

---

### `DELETE /watchlists/{watchlist_id}/items/{item_id}`
Remove an asset from a watchlist.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `watchlist_id` (string), `item_id` (string)
- **Response (`200 OK`)**: Updated watchlist JSON.

---

### `DELETE /watchlists/{watchlist_id}`
Delete a watchlist.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `watchlist_id` (string)
- **Response (`204 No Content`)**

---

## 7. Alerts & Notifications

### `POST /alerts`
Set a price threshold alert.

- **Auth Required**: `Bearer <token>`
- **Request Body**:
```json
{
  "symbol": "BTC",
  "threshold": 70000.0,
  "direction": "ABOVE",
  "enabled": true
}
```
- **Response (`201 Created`)**:
```json
{
  "_id": "6a81b57880a47475f41c0a90",
  "user_id": "6a81b57780a47475f41c0a51",
  "symbol": "BTC",
  "threshold": 70000.0,
  "direction": "ABOVE",
  "enabled": true,
  "triggered_at": null,
  "created_at": "2026-08-16T13:07:00.000000Z"
}
```

---

### `GET /alerts`
List user price alerts.

- **Auth Required**: `Bearer <token>`
- **Response (`200 OK`)**: Array of alert objects.

---

### `DELETE /alerts/{alert_id}`
Delete a price alert.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `alert_id` (string)
- **Response (`204 No Content`)**

---

### `GET /alerts/notifications`
List triggered delivery notifications for alerts.

- **Auth Required**: `Bearer <token>`
- **Response (`200 OK`)**: Array of notification records.

---

## 8. Portfolio Performance

### `POST /portfolios/{portfolio_id}/performance/snapshot`
Record a point-in-time performance snapshot into `portfolio_performance`.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string)
- **Response (`201 Created`)**:
```json
{
  "_id": "6a81b57880a47475f41c0aa0",
  "portfolio_id": "6a81b57780a47475f41c0a54",
  "total_value": 59638.85,
  "total_profit_loss": 4763.85,
  "total_profit_loss_pct": 8.68,
  "timestamp": "2026-08-16T13:08:00.000000Z"
}
```

---

### `GET /portfolios/{portfolio_id}/performance`
Retrieve historical performance timeline snapshots.

- **Auth Required**: `Bearer <token>`
- **Path Parameters**: `portfolio_id` (string)
- **Response (`200 OK`)**: Array of historical snapshots.

---

## 9. Market & Reference Data

### `GET /market/exchanges` | `POST /market/exchanges`
List and add market exchanges.

- **Auth Required**: `Bearer <token>`
- **Request Body (POST)**:
```json
{
  "name": "NASDAQ",
  "country": "United States",
  "url": "https://www.nasdaq.com"
}
```
- **Response (`200 OK` / `201 Created`)**: Exchange object.

---

### `GET /market/news` | `POST /market/news`
List and add financial news articles.

- **Auth Required**: `Bearer <token>`
- **Request Body (POST)**:
```json
{
  "headline": "Tech Equities Rally on Strong Earnings",
  "source": "Bloomberg",
  "url": "https://bloomberg.com/news/123",
  "asset_ids": ["AAPL", "MSFT"]
}
```
- **Response (`201 Created`)**: News article object.

---

### `GET /market/currency-rates` | `POST /market/currency-rates`
Manage ISO foreign currency exchange rates relative to USD.

- **Auth Required**: `Bearer <token>`
- **Request Body (POST)**:
```json
{
  "currency_code": "EUR",
  "rate_to_usd": 1.085
}
```
- **Response (`200 OK`)**: Currency rate object.

---

### `GET /market/audit-logs`
Retrieve user audit trails generated across actions.

- **Auth Required**: `Bearer <token>`
- **Response (`200 OK`)**: Array of audit log objects.

---

## 10. Health & System

### `GET /`
API root welcome and documentation links.

- **Auth Required**: No
- **Response (`200 OK`)**:
```json
{
  "message": "Welcome to Live Stock & Crypto Portfolio Management API",
  "docs_url": "/docs",
  "redoc_url": "/redoc",
  "status": "online"
}
```

---

### `GET /health`
System health check and database connection state.

- **Auth Required**: No
- **Response (`200 OK`)**:
```json
{
  "status": "healthy",
  "database": "connected",
  "environment_file": "item1.env"
}
```
