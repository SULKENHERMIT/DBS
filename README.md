# Live Crypto and Stock Analysis Platform (TimescaleDB Implementation)

### Academic Course: Database Systems (Digital Assignment – 03 / DA-3)
**Extension of Digital Assignment – 02 (DA-2)**  
**Class Slot**: `F2 + TF2`  
**Team Members**:
1. **Narendran R** — Reg. No: `25BDS1161`
2. **Palaniappan R.M** — Reg. No: `25BDS1148`
3. **Kayelesh P** — Reg. No: `25BDS1040`

---

## Project Overview

This repository contains the complete implementation, database schema design, reproducible SQL scripts, sample datasets, analytical queries, and a **dedicated, custom web analytics dashboard** extending the **Live Crypto and Stock Analysis Platform** using **TimescaleDB**.

The implementation preserves the source of truth established in the **DA-2 Project Report**, maintaining all **18 tables**, 14 indexes, 9 PL/pgSQL triggers and functions, and exact sample entities, while introducing high-performance time-series functionality for market prices via TimescaleDB hypertables, continuous aggregates, and columnar compression.

---

## Architecture

The project runs a modern, 3-tier reactive financial architecture completely independent of third-party dashboard tools:

```
┌─────────────────────────────────────────────────────────────┐
│                 REACT + TYPESCRIPT DASHBOARD                │
│             Vite • Tailwind CSS • Recharts • Lucide         │
│               http://localhost:5173 (Port 5173)             │
└──────────────────────────────▲──────────────────────────────┘
                               │ JSON REST API
┌──────────────────────────────▼──────────────────────────────┐
│                    FASTAPI BACKEND SERVICE                  │
│       Python 3.14 • Asyncpg Connection Pool • Pydantic      │
│               http://localhost:8001 (Port 8001)             │
│        Interactive API Docs: http://localhost:8001/docs     │
└──────────────────────────────▲──────────────────────────────┘
                               │ Parameterized SQL
                               │ (Least-privilege role: dashboard_reader)
┌──────────────────────────────▼──────────────────────────────┐
│                  TIMESCALEDB DOCKER ENGINE                  │
│               Container: 'timescale-crypto'                 │
│               Host Port: 5433 -> Container: 5432            │
│         18 Tables • 15 Hypertable Chunks • 4,055 Ticks      │
└─────────────────────────────────────────────────────────────┘
```

---

## Web Dashboard Pages & Features

1. **Market Overview (`/`)**:
   - Executive KPI cards: Tracked assets (6), 24h market volume, top 24h performer (BTC +11.75%), total hypertable observations (4,055 ticks).
   - Interactive Watchlist for all 6 catalog assets (`AAPL`, `BTC`, `ETH`, `NVDA`, `SOL`, `TSLA`).
   - Category filter tabs (`All`, `Crypto`, `Stocks`) and live search.
   - 20-tick sparkline trend visualization per asset.
   - Clickable rows for direct inspection.

2. **Asset Details**:
   - Asset switcher: Quickly toggle between BTC, ETH, SOL, AAPL, NVDA, and TSLA.
   - Dual chart engine:
     - **Hourly OHLC Candlestick Chart** with volume histogram powered by `price_history_hourly_candlestick` continuous aggregate.
     - **Tick Price Line/Area Chart** querying the `price_history` hypertable.
   - Time range selector: `1h`, `24h`, `7d`, `30d`, `all`.
   - Dynamic period statistics: Window start, high, low, latest price, volume-weighted return %.

3. **Portfolio Analytics**:
   - Multi-portfolio selector (`Growth & Multi-Asset Fund`, `Long Term Cold Storage`, `High Beta Crypto-Portfolio`).
   - Live KPI valuation: Market Value ($139,690.31), Cost Basis ($126,085.00), Unrealized Gain (+$13,605.31 / +10.79%).
   - Interactive Asset Allocation Donut Chart.
   - Historical NAV Equity Curve from `portfolio_performance`.
   - Itemized holdings breakdown table: Quantity, Average Buy Price, Current Price, Cost Basis, Market Value, Unrealized PnL ($ and %), and portfolio weight %.

4. **Price Alerts & Dispatch**:
   - Monitored threshold rules from `alerts` table (`ABOVE` / `BELOW`).
   - Status filters (`All`, `Active`, `Triggered`).
   - Notification dispatch history from `notifications` table (`EMAIL`, `SMS`, `PUSH`, `IN_APP`).

5. **TimescaleDB Engine Diagnostics**:
   - Hypertable metadata for `public.price_history`.
   - 15 physical chunk partitions inspection (`timescaledb_information.chunks`).
   - Columnar compression statistics: 56.48% disk space saved, 2.3x compression ratio (`hypertable_compression_stats`).
   - Dynamic daily rollup table powered by native `time_bucket('1 day', timestamp)`, `first()`, and `last()`.

6. **System Infrastructure & Database Health**:
   - Live database connection status and server engine version (TimescaleDB 2.30.2 on PostgreSQL 16.15).
   - Security verification: Least-privilege role `dashboard_reader` enforcement.
   - Data coverage: Observation time bounds and table inventories.

---

## Quick Start: Launching the Application

### 1. Ensure TimescaleDB Container is Running
```powershell
docker start timescale-crypto
```
*(Verify container status with `docker ps --filter "name=timescale-crypto"`)*

### 2. One-Click Launch (Recommended)
Simply double-click or run:
```powershell
.\start_dashboard.bat
```
This automatically:
- Checks the `timescale-crypto` container.
- Launches the Python FastAPI backend on `http://localhost:8001`.
- Launches the Vite React frontend on `http://localhost:5173`.
- Opens your default web browser to the dashboard.

### 3. Manual Launch via Terminal

**Terminal 1 — Backend API**:
```powershell
cd "e:\palani da3\backend"
python run.py
```

**Terminal 2 — Frontend Dashboard**:
```powershell
cd "e:\palani da3\frontend"
npm run dev
```

---

## API Endpoints Reference

The FastAPI backend exposes fully parameterized endpoints documented interactively at `http://localhost:8001/docs`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend and TimescaleDB connection health check |
| `GET` | `/api/system/status` | Database diagnostic metrics, chunk counts, observation bounds |
| `GET` | `/api/market/summary` | Aggregated market volume, top gainers, observation totals |
| `GET` | `/api/market/watchlist` | All 6 catalog assets with live quotes, 24h changes, and sparklines |
| `GET` | `/api/assets` | Full catalog of tracked assets |
| `GET` | `/api/assets/{symbol}` | Detail metadata for a specific asset |
| `GET` | `/api/assets/{symbol}/history` | Parameterized time-series price points (`?range=7d&limit=1000`) |
| `GET` | `/api/assets/{symbol}/candles` | Hourly OHLCV candles from continuous aggregate view |
| `GET` | `/api/assets/{symbol}/stats` | High, low, open, close, and % return over selected time window |
| `GET` | `/api/portfolios` | List all user portfolios |
| `GET` | `/api/portfolios/{id}/valuation` | Real portfolio valuation using `get_portfolio_valuation()` |
| `GET` | `/api/portfolios/{id}/performance`| Historical NAV equity snapshots from `portfolio_performance` |
| `GET` | `/api/alerts` | Configured price threshold alerts (`?status=active`) |
| `GET` | `/api/notifications` | Dispatched notification logs |
| `GET` | `/api/timeseries/hypertable-stats`| Columnar compression metrics and storage space savings |
| `GET` | `/api/timeseries/chunks` | Physical hypertable chunk partitions metadata |
| `GET` | `/api/timeseries/daily-summary`| Daily aggregation rollup using `time_bucket('1 day', timestamp)` |

---

## Security & Best Practices

- **Strict Least-Privilege**: The backend uses the dedicated role `dashboard_reader`. It has `SELECT` access on schemas `public`, `timescaledb_information`, and `_timescaledb_internal`, and `EXECUTE` on valuation functions. All `INSERT`, `UPDATE`, `DELETE`, and `DDL` operations are denied at the database engine level.
- **No Hardcoded Credentials**: Database connection strings are loaded via environment variables (`.env`).
- **No Mock Data**: Every chart, table, card, and metric is backed by actual SQL queries against the TimescaleDB database.
