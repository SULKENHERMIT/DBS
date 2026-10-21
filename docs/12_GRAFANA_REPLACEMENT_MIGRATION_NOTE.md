# 12. Grafana Replacement & Custom Dashboard Migration Note

## Overview
This document records the migration from the prototype Grafana dashboard to the dedicated, fully custom web application for the **Live Crypto and Stock Analysis Platform (TimescaleDB Implementation)**.

---

## 1. Motivation
The project previously ran a temporary Grafana OSS container (`grafana-crypto`) to visualize time-series market data from TimescaleDB. While Grafana served as an initial visualization testbed, a production-grade, customized financial analytics platform requires:
1. **Domain-Specific UI**: Tailored financial interfaces (Asset detail views, interactive OHLC candlestick charts, portfolio allocation donuts, and hypertable engine internals).
2. **Zero Third-Party Dependency**: Eliminating heavy external dashboard servers, proprietary panel JSON schemas, and complex datasource provisioning.
3. **Optimized API Layer**: Direct parameterized SQL access through a modern Python FastAPI service, strictly enforcing the principle of least privilege.
4. **Enhanced User Experience**: Clean dark-mode financial styling, responsive layouts, customizable time windows, and instant data reactivity without Grafana licensing or configuration overhead.

---

## 2. Resources Removed Safely
- **Docker Container**: `grafana-crypto` (stopped and removed cleanly).
- **Configuration Files**: `grafana/provisioning/` (datasources and dashboard providers).
- **Dashboard JSON**: `grafana/dashboards/market_analytics.json`.
- **Generator Scripts**: `scripts/build_dashboard_json.py` and `scripts/start_grafana_container.bat`.

---

## 3. Resources Retained
- **Database Container**: `timescale-crypto` (retained intact on port 5433).
- **Persistent Storage**: All 18 database tables, the `price_history` hypertable (15 chunks, 4,055 ticks), continuous aggregate view `price_history_hourly_candlestick`, and stored functions remain completely untouched.
- **Docker Network**: `timescale-net` retained for database connectivity.
- **Docker Volume**: `grafana-storage` retained safely without deletion per safety rules.
- **Read-Only Database Role**: `grafana_reader` (and its alias `dashboard_reader`) with strict SELECT and EXECUTE permissions is utilized by the backend API.

---

## 4. Replacement Architecture
- **Backend API**: Python FastAPI (`backend/`) running on port `8001`, providing parameterized endpoints for market overview, asset candles, portfolio valuation, alerts, and TimescaleDB hypertable diagnostics.
- **Frontend Dashboard**: React + TypeScript + Vite + Tailwind CSS + Lucide Icons + Recharts (`frontend/`) running on port `5173`, featuring dark navy financial styling, responsive navigation, and real database charts.
