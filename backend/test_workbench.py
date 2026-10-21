import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from fastapi.testclient import TestClient
from app.main import app

def run_tests():
    print("============================================================")
    print("RUNNING AUTOMATED TEST SUITE: SECURE SQL QUERY WORKBENCH")
    print("============================================================")

    with TestClient(app) as client:
        # 1. Test Schema Metadata endpoint
        print("\n[Test 1] Testing GET /api/query-workbench/schema...")
        r = client.get("/api/query-workbench/schema")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        schema = r.json()
        assert schema["status"] == "success"
        assert len(schema["tables"]) >= 10
        assert len(schema["example_queries"]) == 7
        table_names = [t["name"] for t in schema["tables"]]
        assert "price_history" in table_names
        assert "price_history_hourly_candlestick" in table_names
        print(f" PASS: Schema retrieved with {len(schema['tables'])} tables & {len(schema['example_queries'])} examples.")

        # 2. Test Valid SELECT query
        print("\n[Test 2] Testing Valid SELECT query...")
        r = client.post("/api/query-workbench/execute", json={
            "query": "SELECT symbol, price, volume, timestamp FROM price_history ORDER BY timestamp DESC LIMIT 10;"
        })
        assert r.status_code == 200
        res = r.json()
        assert res["success"] is True
        assert res["row_count"] == 10
        assert res["columns"] == ["symbol", "price", "volume", "timestamp"]
        assert len(res["rows"]) == 10
        print(f" PASS: Valid query executed in {res['execution_ms']} ms, returned {res['row_count']} rows.")

        # 3. Test Parameterized query ($1 parameter)
        print("\n[Test 3] Testing Parameterized query with $1...")
        r = client.post("/api/query-workbench/execute", json={
            "query": "SELECT symbol, price, timestamp FROM price_history WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 5;",
            "params": ["BTC"]
        })
        assert r.status_code == 200
        res = r.json()
        assert res["success"] is True
        assert res["row_count"] == 5
        assert all(row[0] == "BTC" for row in res["rows"])
        print(f" PASS: Parameterized query returned {res['row_count']} rows strictly for BTC.")

        # 4. Test Query returning 0 rows
        print("\n[Test 4] Testing Query returning 0 rows...")
        r = client.post("/api/query-workbench/execute", json={
            "query": "SELECT * FROM price_history WHERE symbol = 'NON_EXISTENT_COIN_XYZ';"
        })
        assert r.status_code == 200
        res = r.json()
        assert res["success"] is True
        assert res["row_count"] == 0
        assert res["rows"] == []
        print(" PASS: 0-row result handled cleanly.")

        # 5. Test Invalid column error
        print("\n[Test 5] Testing Invalid column error handling...")
        r = client.post("/api/query-workbench/execute", json={
            "query": "SELECT non_existent_column FROM price_history LIMIT 5;"
        })
        assert r.status_code == 200
        res = r.json()
        assert res["success"] is False
        assert "column \"non_existent_column\" does not exist" in res["error"]
        print(f" PASS: Structured error returned: '{res['error']}'.")

        # 6. Test Malformed SQL syntax error
        print("\n[Test 6] Testing Malformed SQL syntax error...")
        r = client.post("/api/query-workbench/execute", json={
            "query": "SELECT FROM WHERE price_history;"
        })
        assert r.status_code == 200
        res = r.json()
        assert res["success"] is False
        assert "syntax error" in res["error"].lower()
        print(f" PASS: Malformed syntax error reported safely: '{res['error']}'.")

        # 7. Test Multiple statements rejection
        print("\n[Test 7] Testing Multiple statements rejection...")
        r = client.post("/api/query-workbench/execute", json={
            "query": "SELECT * FROM assets; SELECT * FROM portfolios;"
        })
        assert r.status_code == 200
        res = r.json()
        assert res["success"] is False
        assert "multiple sql statements are strictly rejected" in res["error"].lower()
        print(f" PASS: Multiple statements blocked: '{res['error']}'.")

        # 8. Test Write operations rejection (INSERT, UPDATE, DELETE)
        print("\n[Test 8] Testing Write operations rejection...")
        write_queries = [
            "INSERT INTO assets (symbol, name, type) VALUES ('TEST', 'Test', 'crypto');",
            "UPDATE assets SET name = 'Hacked' WHERE symbol = 'BTC';",
            "DELETE FROM price_history WHERE symbol = 'BTC';",
            "TRUNCATE TABLE price_history;",
            "DROP TABLE assets;",
            "ALTER TABLE assets ADD COLUMN hacked text;",
            "GRANT ALL PRIVILEGES ON DATABASE postgres TO public;"
        ]
        for wq in write_queries:
            r = client.post("/api/query-workbench/execute", json={"query": wq})
            assert r.status_code == 200
            res = r.json()
            assert res["success"] is False, f"Write statement should have been blocked: {wq}"
            assert "forbidden" in res["error"].lower() or "only read-only" in res["error"].lower()
        print(f" PASS: All {len(write_queries)} destructive commands were strictly blocked before execution.")

        # 9. Test Dangerous functions & sensitive objects
        print("\n[Test 9] Testing Dangerous functions & sensitive objects...")
        bad_calls = [
            "SELECT pg_read_file('/etc/passwd');",
            "SELECT * FROM pg_shadow;",
            "SELECT * FROM pg_authid;",
            "SELECT dblink('host=evil.com', 'SELECT 1');"
        ]
        for bc in bad_calls:
            r = client.post("/api/query-workbench/execute", json={"query": bc})
            assert r.status_code == 200
            res = r.json()
            assert res["success"] is False, f"Dangerous call should be blocked: {bc}"
        print(f" PASS: All {len(bad_calls)} dangerous function calls and sensitive catalog accesses blocked.")

        # 10. Test Server-Enforced Row Limit & Truncation flag
        print("\n[Test 10] Testing Server-enforced row limit and truncation flag...")
        r = client.post("/api/query-workbench/execute", json={
            "query": "SELECT * FROM price_history;", # no LIMIT in query
            "limit": 25
        })
        assert r.status_code == 200
        res = r.json()
        assert res["success"] is True
        assert res["row_count"] == 25
        assert res["truncated"] is True
        print(f" PASS: Automatic server wrap limited to 25 rows with truncated=True.")

        # 11. Test All 7 Verified Examples Execute Cleanly
        print("\n[Test 11] Testing All 7 Verified Example Queries...")
        for ex in schema["example_queries"]:
            r = client.post("/api/query-workbench/execute", json={
                "query": ex["sql"],
                "limit": 50
            })
            assert r.status_code == 200
            res = r.json()
            assert res["success"] is True, f"Example {ex['id']} failed: {res.get('error')}"
            assert res["row_count"] > 0, f"Example {ex['id']} returned 0 rows"
            print(f" PASS: {ex['name']} ({ex['id']}) returned {res['row_count']} rows in {res['execution_ms']} ms.")

    print("\n============================================================")
    print("ALL 11 TEST SUITES (18 DISTINCT CHECKS) PASSED SUCCESSFULLY!")
    print("============================================================")

if __name__ == "__main__":
    run_tests()
