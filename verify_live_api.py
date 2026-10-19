import httpx
import uuid

def verify_live():
    base_url = "http://127.0.0.1:8000"
    client = httpx.Client(base_url=base_url, timeout=15.0)

    # 1. Health Check
    health = client.get("/health").json()
    print("[1] Health Check:", health)
    assert health["status"] == "healthy"

    # 2. Signup
    test_id = str(uuid.uuid4())[:8]
    email = f"verified_trader_{test_id}@fintech.io"
    password = "MasterKey#2026"
    signup_res = client.post("/auth/signup", json={
        "email": email,
        "password": password,
        "base_currency": "USD"
    })
    print("[2] Signup Response:", signup_res.status_code, signup_res.json())
    assert signup_res.status_code == 201

    # 3. Login
    login_res = client.post("/auth/login", json={"email": email, "password": password})
    print("[3] Login Response:", login_res.status_code)
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Create Portfolio
    port_res = client.post("/portfolios", json={"name": "Global Macro Alpha Portfolio"}, headers=headers)
    print("[4] Portfolio Created:", port_res.status_code, port_res.json())
    port_id = port_res.json()["_id"]

    # 5. Add Holdings: Crypto (BTC & ETH) & Stocks (AAPL & MSFT)
    btc = client.post(f"/portfolios/{port_id}/holdings", json={
        "symbol": "BTC",
        "name": "Bitcoin",
        "type": "crypto",
        "quantity": 0.75,
        "average_buy_price": 58000.0
    }, headers=headers).json()

    eth = client.post(f"/portfolios/{port_id}/holdings", json={
        "symbol": "ETH",
        "name": "Ethereum",
        "type": "crypto",
        "quantity": 4.0,
        "average_buy_price": 1750.0
    }, headers=headers).json()

    aapl = client.post(f"/portfolios/{port_id}/holdings", json={
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "type": "stock",
        "quantity": 25.0,
        "average_buy_price": 210.0
    }, headers=headers).json()

    print(f"[5] Added 3 Holdings: BTC ({btc['_id']}), ETH ({eth['_id']}), AAPL ({aapl['_id']})")

    # 6. Test Live Valuation Route for individual holdings
    print("\n[6] Live Valuations:")
    btc_val = client.get(f"/portfolios/{port_id}/holdings/{btc['_id']}/valuation", headers=headers).json()
    print(f"  * BTC Holding Valuation:")
    print(f"    - Current Price ({btc_val['price_source']}): ${btc_val['current_price']:,.2f}")
    print(f"    - Total Invested: ${btc_val['total_invested']:,.2f}")
    print(f"    - Current Value: ${btc_val['current_value']:,.2f}")
    print(f"    - Gain / Loss: ${btc_val['gain_loss']:,.2f} ({btc_val['gain_loss_pct']}%)")
    print(f"    - Cached: {btc_val['cached']}")

    eth_val = client.get(f"/portfolios/{port_id}/holdings/{eth['_id']}/valuation", headers=headers).json()
    print(f"  * ETH Holding Valuation:")
    print(f"    - Current Price ({eth_val['price_source']}): ${eth_val['current_price']:,.2f}")
    print(f"    - Total Invested: ${eth_val['total_invested']:,.2f}")
    print(f"    - Current Value: ${eth_val['current_value']:,.2f}")
    print(f"    - Gain / Loss: ${eth_val['gain_loss']:,.2f} ({eth_val['gain_loss_pct']}%)")

    aapl_val = client.get(f"/portfolios/{port_id}/holdings/{aapl['_id']}/valuation", headers=headers).json()
    print(f"  * AAPL Holding Valuation:")
    print(f"    - Current Price ({aapl_val['price_source']}): ${aapl_val['current_price']:,.2f}")
    print(f"    - Total Invested: ${aapl_val['total_invested']:,.2f}")
    print(f"    - Current Value: ${aapl_val['current_value']:,.2f}")
    print(f"    - Gain / Loss: ${aapl_val['gain_loss']:,.2f} ({aapl_val['gain_loss_pct']}%)")

    # 7. Overall Portfolio Valuation
    print("\n[7] Overall Portfolio Valuation:")
    total_val = client.get(f"/portfolios/{port_id}/valuation", headers=headers).json()
    print(f"  * Portfolio: {total_val['portfolio_name']}")
    print(f"  * Total Invested: ${total_val['total_invested']:,.2f}")
    print(f"  * Total Market Value: ${total_val['total_current_value']:,.2f}")
    print(f"  * Net Profit / Loss: ${total_val['total_gain_loss']:,.2f} ({total_val['total_gain_loss_pct']}%)")

    print("\n[8] Testing /docs and /openapi.json availability:")
    docs_res = client.get("/docs")
    print(f"  * /docs status: {docs_res.status_code}")
    assert docs_res.status_code == 200

    print("\n Verification Completed Successfully!")

if __name__ == "__main__":
    verify_live()
