import httpx

client = httpx.Client(base_url='http://127.0.0.1:8000', timeout=30.0)
login = client.post('/auth/login', json={'email': 'trader_27f16127@portfolio.io', 'password': 'LiveTestPassword2026!'}).json()
token = login['access_token']
headers = {'Authorization': f'Bearer {token}'}

print('=== TESTING CRYPTO (BTC) HISTORY ===')
for inv in ['1D', '1W', '1M', '3M', '1Y']:
    r = client.get(f'/market/history?symbol=BTC&type=crypto&interval={inv}', headers=headers)
    d = r.json()
    print(f'BTC {inv}: status={r.status_code}, points={len(d.get("data", []))}, current_price={d.get("current_price")}, change={d.get("change")} ({d.get("change_pct")}%)')

print('\n=== TESTING STOCK (NVDA) HISTORY ===')
for inv in ['1D', '1W', '1M', '3M', '1Y']:
    r = client.get(f'/market/history?symbol=NVDA&type=stock&interval={inv}', headers=headers)
    d = r.json()
    print(f'NVDA {inv}: status={r.status_code}, points={len(d.get("data", []))}, current_price={d.get("current_price")}, change={d.get("change")} ({d.get("change_pct")}%)')
