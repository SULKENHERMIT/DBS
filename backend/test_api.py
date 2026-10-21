import asyncio
import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.db import init_db_pool, close_db_pool, fetch_all, fetch_one
from fastapi.testclient import TestClient
from app.main import app

def test_routes():
    print("=== Testing FastAPI Endpoints ===")
    with TestClient(app) as client:
        # 1. Health
        r = client.get("/api/health")
        print("GET /api/health:", r.status_code, r.json())
        assert r.status_code == 200

        # 2. System Status
        r = client.get("/api/system/status")
        print("GET /api/system/status:", r.status_code, r.json()["database_engine"])
        assert r.status_code == 200

        # 3. Market Summary
        r = client.get("/api/market/summary")
        print("GET /api/market/summary:", r.status_code, "Tracked:", r.json()["tracked_assets_count"])
        assert r.status_code == 200

        # 4. Watchlist
        r = client.get("/api/market/watchlist")
        watchlist = r.json()
        print("GET /api/market/watchlist:", r.status_code, "Items:", len(watchlist))
        assert r.status_code == 200
        assert len(watchlist) == 6

        # 5. Asset History
        r = client.get("/api/assets/BTC/history?range=7d")
        history = r.json()
        print("GET /api/assets/BTC/history:", r.status_code, "Points:", len(history))
        assert r.status_code == 200

        # 6. Asset Candles
        r = client.get("/api/assets/BTC/candles?range=7d")
        candles = r.json()
        print("GET /api/assets/BTC/candles:", r.status_code, "Candles:", len(candles))
        assert r.status_code == 200

        # 7. Asset Stats
        r = client.get("/api/assets/BTC/stats?range=7d")
        print("GET /api/assets/BTC/stats:", r.status_code, r.json()["latest_price"])
        assert r.status_code == 200

        # 8. Portfolios
        r = client.get("/api/portfolios")
        portfolios = r.json()
        print("GET /api/portfolios:", r.status_code, "Portfolios:", len(portfolios))
        assert r.status_code == 200
        pid = portfolios[0]["portfolio_id"]

        # 9. Portfolio Valuation
        r = client.get(f"/api/portfolios/{pid}/valuation")
        val = r.json()
        print(f"GET /api/portfolios/{pid}/valuation:", r.status_code, "Market Value: ${:,.2f}".format(val["total_market_value"]))
        assert r.status_code == 200

        # 10. Portfolio Performance
        r = client.get(f"/api/portfolios/{pid}/performance")
        print(f"GET /api/portfolios/{pid}/performance:", r.status_code, "Points:", len(r.json()))
        assert r.status_code == 200

        # 11. Alerts & Notifications
        r = client.get("/api/alerts")
        print("GET /api/alerts:", r.status_code, "Alerts:", len(r.json()))
        assert r.status_code == 200

        r = client.get("/api/notifications")
        print("GET /api/notifications:", r.status_code, "Notifications:", len(r.json()))
        assert r.status_code == 200

        # 12. Hypertable Stats & Chunks
        r = client.get("/api/timeseries/hypertable-stats")
        print("GET /api/timeseries/hypertable-stats:", r.status_code, "Chunks:", r.json()["total_chunks"], "Saved:", f"{r.json()['space_saved_pct']}%")
        assert r.status_code == 200

        r = client.get("/api/timeseries/chunks")
        print("GET /api/timeseries/chunks:", r.status_code, "Chunks listed:", len(r.json()))
        assert r.status_code == 200

    print("=== ALL 14 FASTAPI ENDPOINT TESTS PASSED WITH 200 OK! ===")

if __name__ == "__main__":
    test_routes()
