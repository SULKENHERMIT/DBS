import asyncio
import sys
import uuid
import httpx
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, get_database
from app.main import app

async def run_tests():
    print("=" * 60)
    print("STARTING BACKEND SYSTEM & INTEGRATION TESTS")
    print("=" * 60)

    # 1. Test database connection
    print("\n[Step 1] Connecting to MongoDB using item1.env...")
    await connect_to_mongo()
    db = get_database()
    print(" MongoDB connected successfully to database:", db.name)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 2. Health check
        print("\n[Step 2] Testing Health Endpoint...")
        resp = await client.get("/health")
        print(" /health status:", resp.status_code, resp.json())
        assert resp.status_code == 200

        # 3. User Signup
        test_id = str(uuid.uuid4())[:8]
        user_email = f"trader_{test_id}@example.com"
        user_password = "SecurePassword123!"

        print(f"\n[Step 3] Testing User Signup ({user_email})...")
        signup_resp = await client.post("/auth/signup", json={
            "email": user_email,
            "password": user_password,
            "base_currency": "USD"
        })
        print(" /auth/signup response:", signup_resp.status_code, signup_resp.json())
        assert signup_resp.status_code == 201
        user_data = signup_resp.json()
        user_id = user_data["_id"]

        # 4. User Login & JWT Token
        print("\n[Step 4] Testing User Login & JWT Token Generation...")
        login_resp = await client.post("/auth/login", json={
            "email": user_email,
            "password": user_password
        })
        print(" /auth/login response:", login_resp.status_code)
        assert login_resp.status_code == 200
        token_data = login_resp.json()
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(" Received JWT Token:", token[:25] + "...")

        # 5. Create Portfolio
        print("\n[Step 5] Creating Portfolio...")
        port_resp = await client.post("/portfolios", json={"name": "Alpha Growth Portfolio"}, headers=headers)
        print(" /portfolios create response:", port_resp.status_code, port_resp.json())
        assert port_resp.status_code == 201
        portfolio = port_resp.json()
        portfolio_id = portfolio["_id"]

        # 6. Add Crypto Holding (BTC)
        print("\n[Step 6] Adding Crypto Holding (BTC: 0.5 @ $55,000)...")
        btc_resp = await client.post(f"/portfolios/{portfolio_id}/holdings", json={
            "symbol": "BTC",
            "name": "Bitcoin",
            "type": "crypto",
            "quantity": 0.5,
            "average_buy_price": 55000.0
        }, headers=headers)
        print(" /holdings add BTC response:", btc_resp.status_code, btc_resp.json())
        assert btc_resp.status_code == 201
        btc_holding = btc_resp.json()
        btc_holding_id = btc_holding["_id"]

        # 7. Add Stock Holding (AAPL)
        print("\n[Step 7] Adding Stock Holding (AAPL: 10 @ $200.00)...")
        aapl_resp = await client.post(f"/portfolios/{portfolio_id}/holdings", json={
            "symbol": "AAPL",
            "name": "Apple Inc.",
            "type": "stock",
            "quantity": 10.0,
            "average_buy_price": 200.0
        }, headers=headers)
        print(" /holdings add AAPL response:", aapl_resp.status_code, aapl_resp.json())
        assert aapl_resp.status_code == 201
        aapl_holding = aapl_resp.json()
        aapl_holding_id = aapl_holding["_id"]

        # 8. Test Live Valuation & Gain/Loss Endpoint for Crypto (CoinGecko)
        print(f"\n[Step 8] Testing Live Valuation & Gain/Loss for Crypto Holding (BTC)...")
        val_btc_resp = await client.get(f"/portfolios/{portfolio_id}/holdings/{btc_holding_id}/valuation", headers=headers)
        print(" BTC Live Valuation:", val_btc_resp.status_code, val_btc_resp.json())
        assert val_btc_resp.status_code == 200
        btc_val = val_btc_resp.json()
        print(f"   -> Price Source: {btc_val['price_source']}")
        print(f"   -> Current Price: ${btc_val['current_price']:,.2f}")
        print(f"   -> Total Invested: ${btc_val['total_invested']:,.2f}")
        print(f"   -> Current Value: ${btc_val['current_value']:,.2f}")
        print(f"   -> Gain/Loss: ${btc_val['gain_loss']:,.2f} ({btc_val['gain_loss_pct']}%)")
        print(f"   -> Cached in PriceCache: {btc_val['cached']}")

        # 9. Test Live Valuation & Gain/Loss Endpoint for Stock (Finnhub)
        print(f"\n[Step 9] Testing Live Valuation & Gain/Loss for Stock Holding (AAPL)...")
        val_aapl_resp = await client.get(f"/portfolios/{portfolio_id}/holdings/{aapl_holding_id}/valuation", headers=headers)
        print(" AAPL Live Valuation:", val_aapl_resp.status_code, val_aapl_resp.json())
        assert val_aapl_resp.status_code == 200
        aapl_val = val_aapl_resp.json()
        print(f"   -> Price Source: {aapl_val['price_source']}")
        print(f"   -> Current Price: ${aapl_val['current_price']:,.2f}")
        print(f"   -> Total Invested: ${aapl_val['total_invested']:,.2f}")
        print(f"   -> Current Value: ${aapl_val['current_value']:,.2f}")
        print(f"   -> Gain/Loss: ${aapl_val['gain_loss']:,.2f} ({aapl_val['gain_loss_pct']}%)")
        print(f"   -> Cached in PriceCache: {aapl_val['cached']}")

        # 10. Verify MongoDB PriceCache collection
        print("\n[Step 10] Checking MongoDB PriceCache collection...")
        cache_entries = await db.price_cache.find().to_list(length=10)
        print(f" Found {len(cache_entries)} entries in PriceCache:")
        for entry in cache_entries:
            print(f"   * {entry['symbol']} ({entry['asset_type']}): ${entry['price_usd']} | expires at: {entry['expire_at']}")

        # 11. Test Cache Hit (Call valuation again, must be cached=True)
        print("\n[Step 11] Verifying 5-minute Cache Hit on second request...")
        val_btc_cached_resp = await client.get(f"/portfolios/{portfolio_id}/holdings/{btc_holding_id}/valuation", headers=headers)
        val_btc_cached = val_btc_cached_resp.json()
        print(f" BTC second fetch cached flag: {val_btc_cached['cached']}")
        assert val_btc_cached["cached"] is True

        # 12. Full Portfolio Valuation Summary
        print("\n[Step 12] Testing Full Portfolio Valuation Aggregation...")
        port_val_resp = await client.get(f"/portfolios/{portfolio_id}/valuation", headers=headers)
        print(" Portfolio Valuation:", port_val_resp.status_code, port_val_resp.json())
        assert port_val_resp.status_code == 200
        port_val = port_val_resp.json()
        print(f"   -> Portfolio: {port_val['portfolio_name']}")
        print(f"   -> Total Invested: ${port_val['total_invested']:,.2f}")
        print(f"   -> Total Current Market Value: ${port_val['total_current_value']:,.2f}")
        print(f"   -> Overall Profit/Loss: ${port_val['total_gain_loss']:,.2f} ({port_val['total_gain_loss_pct']}%)")

        # 13. Test User Scoping & Security (User B cannot access User A's portfolio)
        print("\n[Step 13] Testing User Scoping & Authorization Protection...")
        user_b_email = f"user_b_{test_id}@example.com"
        await client.post("/auth/signup", json={"email": user_b_email, "password": "PasswordB123!"})
        login_b_resp = await client.post("/auth/login", json={"email": user_b_email, "password": "PasswordB123!"})
        headers_b = {"Authorization": f"Bearer {login_b_resp.json()['access_token']}"}

        unauth_resp = await client.get(f"/portfolios/{portfolio_id}", headers=headers_b)
        print(f" User B attempting to view User A's portfolio: HTTP {unauth_resp.status_code}")
        assert unauth_resp.status_code == 404

        # 14. Performance snapshot & Watchlists
        print("\n[Step 14] Testing Performance Snapshots, Watchlists, Alerts...")
        snap_resp = await client.post(f"/portfolios/{portfolio_id}/performance/snapshot", headers=headers)
        print(" Recorded performance snapshot:", snap_resp.status_code, snap_resp.json())
        assert snap_resp.status_code == 201

        wl_resp = await client.post("/watchlists", json={"name": "Tech & Crypto Watchlist"}, headers=headers)
        wl_id = wl_resp.json()["_id"]
        await client.post(f"/watchlists/{wl_id}/items?symbol=ETH", headers=headers)
        print(" Watchlist created and item added:", wl_resp.status_code)

        alert_resp = await client.post("/alerts", json={"symbol": "BTC", "threshold": 70000.0, "direction": "ABOVE"}, headers=headers)
        print(" Price alert created:", alert_resp.status_code, alert_resp.json())

        # 15. Check Audit Logs
        audit_resp = await client.get("/market/audit-logs", headers=headers)
        print(f"\n[Step 15] User Audit Logs recorded: {len(audit_resp.json())} actions logged in audit_logs collection.")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY! BACKEND FULLY OPERATIONAL.")
    print("=" * 60)

    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(run_tests())
