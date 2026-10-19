import httpx

client = httpx.Client(base_url='http://127.0.0.1:8000')

print('=== 1. LOGIN ===')
login = client.post('/auth/login', json={'email': 'trader_27f16127@portfolio.io', 'password': 'LiveTestPassword2026!'}).json()
token = login['access_token']
headers = {'Authorization': f'Bearer {token}'}
print('Token acquired:', token[:20] + '...')

print('\n=== 2. CREATE PORTFOLIO ===')
create_res = client.post('/portfolios', json={'name': 'Tech & Crypto Fund 2026'}, headers=headers)
print('Create Status:', create_res.status_code)
portfolio = create_res.json()
p_id = portfolio.get('_id') or portfolio.get('id')
print('Portfolio Created with Real ID:', p_id)
assert p_id and p_id != 'undefined', 'Portfolio ID must be valid!'

print('\n=== 3. SEARCH REAL SYMBOLS (Autocomplete API) ===')
s_stock = client.get('/market/symbols?type=stock&query=NVDA', headers=headers).json()
print('Stock Autocomplete (NVDA):', s_stock[:1])
s_crypto = client.get('/market/symbols?type=crypto&query=SOL', headers=headers).json()
print('Crypto Autocomplete (SOL):', s_crypto[:1])

assert len(s_stock) > 0 and s_stock[0]['symbol'] == 'NVDA', 'NVDA stock symbol must be found'
assert len(s_crypto) > 0 and s_crypto[0]['symbol'] == 'SOL', 'SOL crypto symbol must be found'

print('\n=== 4. ADD HOLDINGS ===')
h1_res = client.post(f'/portfolios/{p_id}/holdings', json={
    'symbol': s_stock[0]['symbol'],
    'name': s_stock[0]['name'],
    'type': 'stock',
    'quantity': 15.0,
    'average_buy_price': 120.0
}, headers=headers)
print('Added NVDA Status:', h1_res.status_code)
h1_data = h1_res.json()
h1_id = h1_data.get('_id') or h1_data.get('id')
print('NVDA Holding ID:', h1_id)

h2_res = client.post(f'/portfolios/{p_id}/holdings', json={
    'symbol': s_crypto[0]['symbol'],
    'name': s_crypto[0]['name'],
    'type': 'crypto',
    'quantity': 30.0,
    'average_buy_price': 145.0
}, headers=headers)
print('Added SOL Status:', h2_res.status_code)
h2_data = h2_res.json()
h2_id = h2_data.get('_id') or h2_data.get('id')
print('SOL Holding ID:', h2_id)

print('\n=== 5. VIEW PORTFOLIO & LIVE VALUATION ===')
p_detail = client.get(f'/portfolios/{p_id}', headers=headers).json()
print('Holdings Count in Portfolio:', len(p_detail['holdings']))
val_res = client.get(f'/portfolios/{p_id}/valuation', headers=headers).json()
print('Total Invested: $' + str(val_res['total_invested']))
print('Total Current Value: $' + str(val_res['total_current_value']))
print('Total Gain/Loss: $' + str(val_res['total_gain_loss']) + ' (' + str(val_res['total_gain_loss_pct']) + '%)')
for h in val_res['holdings_valuation']:
    print(f"  - {h['symbol']} ({h['type']}): Qty {h['quantity']} @ ${h['current_price']} USD | Market Value: ${h['current_value']} | Gain: ${h['gain_loss']} ({h['gain_loss_pct']}%)")

print('\n=== 6. DELETE HOLDING (SOL) ===')
del_h_res = client.delete(f'/portfolios/{p_id}/holdings/{h2_id}', headers=headers)
print('Delete SOL Status:', del_h_res.status_code)
p_after_h_del = client.get(f'/portfolios/{p_id}', headers=headers).json()
print('Holdings remaining after deletion:', [h['symbol'] for h in p_after_h_del['holdings']])
assert len(p_after_h_del['holdings']) == 1, 'Only 1 holding should remain'

print('\n=== 7. DELETE PORTFOLIO ===')
del_p_res = client.delete(f'/portfolios/{p_id}', headers=headers)
print('Delete Portfolio Status:', del_p_res.status_code)
p_list_after = client.get('/portfolios', headers=headers).json()
p_ids_remaining = [p.get('_id') or p.get('id') for p in p_list_after]
print('Remaining portfolio IDs:', p_ids_remaining)
assert p_id not in p_ids_remaining, 'Deleted portfolio must not exist in list'

print('\n>>> ALL STEPS PASSED SUCCESSFULLY WITH REAL OBJECT IDs! <<<')
