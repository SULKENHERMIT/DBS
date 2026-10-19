import httpx
import json
import uuid
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_test():
    print(f"Connecting to live FastAPI server at {BASE_URL}...\n")
    client = httpx.Client(base_url=BASE_URL, timeout=20.0)

    # Check Health
    try:
        health_resp = client.get("/health")
        print(f"[Health Check] HTTP {health_resp.status_code} -> {health_resp.json()}")
    except Exception as e:
        print(f"ERROR: Server is not reachable at {BASE_URL}: {e}")
        sys.exit(1)

    # 1. Signup a test user
    uid = str(uuid.uuid4())[:8]
    email = f"trader_{uid}@portfolio.io"
    password = "LiveTestPassword2026!"
    
    print("\n" + "=" * 60)
    print("STEP 1: SIGNUP A TEST USER")
    print("=" * 60)
    signup_req = {
        "email": email,
        "password": password,
        "base_currency": "USD"
    }
    print(f"Request: POST /auth/signup\nPayload: {json.dumps(signup_req, indent=2)}")
    signup_res = client.post("/auth/signup", json=signup_req)
    print(f"Response: HTTP {signup_res.status_code}\nBody: {json.dumps(signup_res.json(), indent=2)}")
    assert signup_res.status_code == 201, "Signup failed"

    # 2. Login and get JWT token
    print("\n" + "=" * 60)
    print("STEP 2: LOGIN AND GET JWT TOKEN")
    print("=" * 60)
    login_req = {
        "email": email,
        "password": password
    }
    print(f"Request: POST /auth/login\nPayload: {json.dumps(login_req, indent=2)}")
    login_res = client.post("/auth/login", json=login_req)
    print(f"Response: HTTP {login_res.status_code}\nBody: {json.dumps(login_res.json(), indent=2)}")
    assert login_res.status_code == 200, "Login failed"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create a portfolio
    print("\n" + "=" * 60)
    print("STEP 3: CREATE A PORTFOLIO")
    print("=" * 60)
    port_req = {
        "name": "Live Flagship Alpha Portfolio"
    }
    print(f"Request: POST /portfolios\nPayload: {json.dumps(port_req, indent=2)}")
    port_res = client.post("/portfolios", json=port_req, headers=headers)
    print(f"Response: HTTP {port_res.status_code}\nBody: {json.dumps(port_res.json(), indent=2)}")
    assert port_res.status_code == 201, "Portfolio creation failed"
    portfolio_id = port_res.json()["_id"]

    # 4. Add a crypto holding (BTC) and a stock holding (AAPL)
    print("\n" + "=" * 60)
    print("STEP 4a: ADD CRYPTO HOLDING (BTC)")
    print("=" * 60)
    btc_req = {
        "symbol": "BTC",
        "name": "Bitcoin",
        "type": "crypto",
        "quantity": 0.85,
        "average_buy_price": 59500.0
    }
    print(f"Request: POST /portfolios/{portfolio_id}/holdings\nPayload: {json.dumps(btc_req, indent=2)}")
    btc_res = client.post(f"/portfolios/{portfolio_id}/holdings", json=btc_req, headers=headers)
    print(f"Response: HTTP {btc_res.status_code}\nBody: {json.dumps(btc_res.json(), indent=2)}")
    assert btc_res.status_code == 201, "BTC holding creation failed"
    btc_id = btc_res.json()["_id"]

    print("\n" + "=" * 60)
    print("STEP 4b: ADD STOCK HOLDING (AAPL)")
    print("=" * 60)
    aapl_req = {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "type": "stock",
        "quantity": 20.0,
        "average_buy_price": 215.0
    }
    print(f"Request: POST /portfolios/{portfolio_id}/holdings\nPayload: {json.dumps(aapl_req, indent=2)}")
    aapl_res = client.post(f"/portfolios/{portfolio_id}/holdings", json=aapl_req, headers=headers)
    print(f"Response: HTTP {aapl_res.status_code}\nBody: {json.dumps(aapl_res.json(), indent=2)}")
    assert aapl_res.status_code == 201, "AAPL holding creation failed"
    aapl_id = aapl_res.json()["_id"]

    # 5. Check both holdings' valuation with live prices
    print("\n" + "=" * 60)
    print("STEP 5a: CHECK BTC HOLDING VALUATION (LIVE COINGECKO PRICE)")
    print("=" * 60)
    print(f"Request: GET /portfolios/{portfolio_id}/holdings/{btc_id}/valuation")
    btc_val_res = client.get(f"/portfolios/{portfolio_id}/holdings/{btc_id}/valuation", headers=headers)
    print(f"Response: HTTP {btc_val_res.status_code}\nBody: {json.dumps(btc_val_res.json(), indent=2)}")
    assert btc_val_res.status_code == 200, "BTC valuation failed"

    print("\n" + "=" * 60)
    print("STEP 5b: CHECK AAPL HOLDING VALUATION (LIVE FINNHUB PRICE)")
    print("=" * 60)
    print(f"Request: GET /portfolios/{portfolio_id}/holdings/{aapl_id}/valuation")
    aapl_val_res = client.get(f"/portfolios/{portfolio_id}/holdings/{aapl_id}/valuation", headers=headers)
    print(f"Response: HTTP {aapl_val_res.status_code}\nBody: {json.dumps(aapl_val_res.json(), indent=2)}")
    assert aapl_val_res.status_code == 200, "AAPL valuation failed"

    # 6. Check the portfolio's total valuation
    print("\n" + "=" * 60)
    print("STEP 6: CHECK TOTAL PORTFOLIO VALUATION")
    print("=" * 60)
    print(f"Request: GET /portfolios/{portfolio_id}/valuation")
    port_val_res = client.get(f"/portfolios/{portfolio_id}/valuation", headers=headers)
    print(f"Response: HTTP {port_val_res.status_code}\nBody: {json.dumps(port_val_res.json(), indent=2)}")
    assert port_val_res.status_code == 200, "Portfolio valuation failed"

    print("\n" + "=" * 60)
    print("ALL SEQUENCE STEPS COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_test()
