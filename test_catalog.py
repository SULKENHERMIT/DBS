import httpx

client = httpx.Client(base_url='http://127.0.0.1:8000', timeout=30.0)
login = client.post('/auth/login', json={'email': 'trader_27f16127@portfolio.io', 'password': 'LiveTestPassword2026!'}).json()
token = login['access_token']
headers = {'Authorization': f'Bearer {token}'}

# 1. Stats
stats = client.get('/market/symbols/stats', headers=headers).json()
print('Catalog Statistics:', stats)

# 2. Test search across obscure / mid-cap / large-cap stocks
for q in ['AAPL', 'PLTR', 'ARM', 'DELL', 'BABA', 'CRWD', 'UBER']:
    res = client.get(f'/market/symbols?type=stock&query={q}&limit=5', headers=headers).json()
    print(f'Stock search "{q}" returned {len(res)} matches -> Top match:', res[0]['symbol'], ':', res[0]['name'])

# 3. Test search across cryptos
for q in ['BTC', 'ETH', 'SOL', 'PEPE', 'SHIB', 'DOGE', 'AVAX', 'LINK']:
    res = client.get(f'/market/symbols?type=crypto&query={q}&limit=5', headers=headers).json()
    print(f'Crypto search "{q}" returned {len(res)} matches -> Top match:', res[0]['symbol'], ':', res[0]['name'])

# 4. Verify all symbols endpoints
stocks_all = client.get('/market/symbols/all?type=stock', headers=headers).json()
crypto_all = client.get('/market/symbols/all?type=crypto', headers=headers).json()
print(f'Full All US Stocks Catalog Size: {len(stocks_all):,} items')
print(f'Full All Crypto Coins Catalog Size: {len(crypto_all):,} items')
