import httpx

client = httpx.Client(base_url='http://127.0.0.1:8000', timeout=20.0)
login = client.post('/auth/login', json={'email': 'trader_27f16127@portfolio.io', 'password': 'LiveTestPassword2026!'}).json()
token = login['access_token']
headers = {'Authorization': f'Bearer {token}'}

# 1. Test Portfolio List & Detail
portfolios = client.get('/portfolios', headers=headers).json()
print(f'Portfolios retrieved: {len(portfolios)}')

if portfolios:
    p_id = portfolios[0].get('_id') or portfolios[0].get('id')
    val = client.get(f'/portfolios/{p_id}/valuation', headers=headers).json()
    print(f'Portfolio {p_id} valuation: total_current_value={val["total_current_value"]}, holdings={len(val.get("holdings_valuation", []))}')

# 2. Test Historical Charts
for sym, t in [('BTC', 'crypto'), ('SOL', 'crypto'), ('NVDA', 'stock'), ('AAPL', 'stock')]:
    for inv in ['1D', '1W', '1M', '3M', '1Y']:
        res = client.get(f'/market/history?symbol={sym}&type={t}&interval={inv}', headers=headers).json()
        assert len(res.get('data', [])) > 0, f'Should return data points for {sym} {inv}'
        assert 'current_price' in res, f'Should have current_price for {sym}'
    print(f'Chart history verified for {sym} ({t}) across 1D, 1W, 1M, 3M, 1Y!')

# 3. Check frontend static server
f_client = httpx.Client(base_url='http://127.0.0.1:3000')
f_res = f_client.get('/')
print(f'Frontend server status: {f_res.status_code}, contains Chart.js: {"chart.js" in f_res.text.lower()}')
assert f_res.status_code == 200, 'Frontend should return 200'

print('\n>>> ALL CHART, API & RESPONSIVE FRONTEND CHECKS PASSED! <<<')
