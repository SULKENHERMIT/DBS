import asyncio
import sys
import uuid
import httpx
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, get_database
from app.main import app

async def run_full_sequence_test():
    print("=" * 70)
    print("RUNNING FULL API SEQUENCE TEST")
    print("=" * 70)

    # 0. Connect to MongoDB
    print("\n[Step 0] Initializing MongoDB Connection from item1.env...")
    try:
        await connect_to_mongo()
        db = get_database()
        print(f"-> SUCCESS: MongoDB connected to database: '{db.name}'")
    except Exception as e:
        print(f"-> ERROR connecting to MongoDB: {e}")
        return False

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Signup a test user
        test_id = str(uuid.uuid4())[:8]
        user_email = f"test_trader_{test_id}@example.com"
        user_password = "SecurePassword2026!"

        print(f"\n[Step 1] Signup Test User ({user_email})...")
        signup_payload = {
            "email": user_email,
            "password": user_password,
            "base_currency": "USD"
        }
        signup_resp = await client.post("/auth/signup", json=signup_payload)
        print(f"Status: {signup_resp.status_code}")
        print(f"Response: {signup_resp.json()}")
        if signup_resp.status_code != 201:
            print("-> FAILED: Signup failed!")
            return False
        user_id = signup_resp.json()["_id"]
        print(f"-> SUCCESS: Created User ID: {user_id}")

        # Step 2: Login and get JWT token
        print(f"\n[Step 2] Login with User Credentials and Get JWT Token...")
        login_payload = {
            "email": user_email,
            "password": user_password
        }
        login_resp = await client.post("/auth/login", json=login_payload)
        print(f"Status: {login_resp.status_code}")
        print(f"Response: {login_resp.json()}")
        if login_resp.status_code != 200:
            print("-> FAILED: Login failed!")
            return False
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"-> SUCCESS: Obtained JWT Token: {token[:25]}...")

        # Step 3: Create a portfolio
        print(f"\n[Step 3] Create Portfolio...")
        portfolio_payload = {
            "name": "Main Growth Portfolio"
        }
        port_resp = await client.post("/portfolios", json=portfolio_payload, headers=headers)
        print(f"Status: {port_resp.status_code}")
        print(f"Response: {port_resp.json()}")
        if port_resp.status_code != 201:
            print("-> FAILED: Create portfolio failed!")
            return False
        portfolio_id = port_resp.json()["_id"]
        print(f"-> SUCCESS: Created Portfolio ID: {portfolio_id}")

        # Step 4: Add Crypto holding (BTC) and Stock holding (AAPL)
        print(f"\n[Step 4a] Add Crypto Holding (BTC: 0.5 @ $60,000)...")
        btc_payload = {
            "symbol": "BTC",
            "name": "Bitcoin",
            "type": "crypto",
            "quantity": 0.5,
            "average_buy_price": 60000.0
        }
        btc_resp = await client.post(f"/portfolios/{portfolio_id}/holdings", json=btc_payload, headers=headers)
        print(f"Status: {btc_resp.status_code}")
        print(f"Response: {btc_resp.json()}")
        if btc_resp.status_code != 201:
            print("-> FAILED: Add BTC holding failed!")
            return False
        btc_holding_id = btc_resp.json()["_id"]
        print(f"-> SUCCESS: Added BTC Holding ID: {btc_holding_id}")

        print(f"\n[Step 4b] Add Stock Holding (AAPL: 10 @ $210.00)...")
        aapl_payload = {
            "symbol": "AAPL",
            "name": "Apple Inc.",
            "type": "stock",
            "quantity": 10.0,
            "average_buy_price": 210.0
        }
        aapl_resp = await client.post(f"/portfolios/{portfolio_id}/holdings", json=aapl_payload, headers=headers)
        print(f"Status: {aapl_resp.status_code}")
        print(f"Response: {aapl_resp.json()}")
        if aapl_resp.status_code != 201:
            print("-> FAILED: Add AAPL holding failed!")
            return False
        aapl_holding_id = aapl_resp.json()["_id"]
        print(f"-> SUCCESS: Added AAPL Holding ID: {aapl_holding_id}")

        # Step 5: Get holding valuation for both (confirm live prices)
        print(f"\n[Step 5a] Get Live Holding Valuation for Crypto (BTC)...")
        btc_val_resp = await client.get(f"/portfolios/{portfolio_id}/holdings/{btc_holding_id}/valuation", headers=headers)
        print(f"Status: {btc_val_resp.status_code}")
        print(f"Response: {btc_val_resp.json()}")
        if btc_val_resp.status_code != 200:
            print("-> FAILED: BTC holding valuation failed!")
            return False
        btc_val = btc_val_resp.json()
        print(f"   * Price Source: {btc_val['price_source']}")
        print(f"   * Live BTC Price: ${btc_val['current_price']:,.2f}")
        print(f"   * Total Invested: ${btc_val['total_invested']:,.2f}")
        print(f"   * Current Value: ${btc_val['current_value']:,.2f}")
        print(f"   * Gain / Loss: ${btc_val['gain_loss']:,.2f} ({btc_val['gain_loss_pct']}%)")
        print(f"   * Cached: {btc_val['cached']}")

        print(f"\n[Step 5b] Get Live Holding Valuation for Stock (AAPL)...")
        aapl_val_resp = await client.get(f"/portfolios/{portfolio_id}/holdings/{aapl_holding_id}/valuation", headers=headers)
        print(f"Status: {aapl_val_resp.status_code}")
        print(f"Response: {aapl_val_resp.json()}")
        if aapl_val_resp.status_code != 200:
            print("-> FAILED: AAPL holding valuation failed!")
            return False
        aapl_val = aapl_val_resp.json()
        print(f"   * Price Source: {aapl_val['price_source']}")
        print(f"   * Live AAPL Price: ${aapl_val['current_price']:,.2f}")
        print(f"   * Total Invested: ${aapl_val['total_invested']:,.2f}")
        print(f"   * Current Value: ${aapl_val['current_value']:,.2f}")
        print(f"   * Gain / Loss: ${aapl_val['gain_loss']:,.2f} ({aapl_val['gain_loss_pct']}%)")
        print(f"   * Cached: {aapl_val['cached']}")

        # Step 6: Get portfolio valuation
        print(f"\n[Step 6] Get Portfolio Valuation...")
        port_val_resp = await client.get(f"/portfolios/{portfolio_id}/valuation", headers=headers)
        print(f"Status: {port_val_resp.status_code}")
        print(f"Response: {port_val_resp.json()}")
        if port_val_resp.status_code != 200:
            print("-> FAILED: Portfolio valuation failed!")
            return False
        port_val = port_val_resp.json()
        print(f"   * Portfolio Name: {port_val['portfolio_name']}")
        print(f"   * Total Invested: ${port_val['total_invested']:,.2f}")
        print(f"   * Total Market Value: ${port_val['total_current_value']:,.2f}")
        print(f"   * Total Net Profit / Loss: ${port_val['total_gain_loss']:,.2f} ({port_val['total_gain_loss_pct']}%)")
        print(f"   * Holdings Evaluated: {len(port_val['holdings_valuation'])}")

    print("\n" + "=" * 70)
    print("ALL 6 SEQUENCE STEPS EXECUTED AND PASSED SUCCESSFULLY!")
    print("=" * 70)

    await close_mongo_connection()
    return True

if __name__ == "__main__":
    success = asyncio.run(run_full_sequence_test())
    if not success:
        sys.exit(1)
