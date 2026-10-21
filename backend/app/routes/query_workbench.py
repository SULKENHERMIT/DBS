from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import time
from app.db import fetch_all

router = APIRouter(prefix="/query-workbench", tags=["Interactive Query Workbench"])

class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    row_count: int
    execution_time_ms: float

class TableColumn(BaseModel):
    column_name: str
    data_type: str
    is_nullable: str

class TableSchema(BaseModel):
    table_name: str
    columns: List[TableColumn]

@router.get("/schema", response_model=List[TableSchema])
async def get_database_schema():
    try:
        raw_cols = await fetch_all("""
            SELECT 
                c.table_name,
                c.column_name,
                c.data_type,
                c.is_nullable
            FROM information_schema.columns c
            JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
            WHERE c.table_schema = 'public' AND t.table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY c.table_name, c.ordinal_position;
        """)

        tables_map: Dict[str, List[TableColumn]] = {}
        for row in raw_cols:
            tname = row["table_name"]
            if tname not in tables_map:
                tables_map[tname] = []
            tables_map[tname].append(TableColumn(
                column_name=row["column_name"],
                data_type=row["data_type"],
                is_nullable=row["is_nullable"]
            ))

        return [
            TableSchema(table_name=tname, columns=cols)
            for tname, cols in tables_map.items()
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch database schema: {str(e)}")

@router.post("/execute", response_model=QueryResponse)
async def execute_user_query(req: QueryRequest):
    sql = req.query.strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query string cannot be empty")

    # Safety check: enforce read-only SELECT or WITH
    upper_sql = sql.upper().lstrip()
    if not (upper_sql.startswith("SELECT") or upper_sql.startswith("WITH") or upper_sql.startswith("EXPLAIN")):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: The Query Workbench strictly permits read-only SELECT, WITH, or EXPLAIN statements."
        )

    # Disallow destructive commands
    forbidden = ["DROP", "DELETE", "TRUNCATE", "INSERT", "UPDATE", "ALTER", "CREATE", "GRANT", "REVOKE"]
    for word in forbidden:
        # Check as whole word
        if f" {word} " in f" {upper_sql} " or f"\n{word} " in f" {upper_sql} ":
            raise HTTPException(status_code=403, detail=f"Forbidden keyword '{word}' in read-only workbench query")

    try:
        t0 = time.perf_counter()
        raw_rows = await fetch_all(sql)
        t1 = time.perf_counter()
        exec_ms = round((t1 - t0) * 1000.0, 2)

        columns = list(raw_rows[0].keys()) if raw_rows else []
        # Convert any non-serializable objects (like Decimal or UUID or datetime)
        serialized_rows: List[Dict[str, Any]] = []
        for r in raw_rows[:500]: # max 500 rows preview
            s_row = {}
            for k, v in r.items():
                if hasattr(v, "isoformat"):
                    s_row[k] = v.isoformat()
                elif hasattr(v, "__str__") and type(v).__name__ in ("UUID", "Decimal"):
                    s_row[k] = str(v)
                else:
                    s_row[k] = v
            serialized_rows.append(s_row)

        return QueryResponse(
            columns=columns,
            rows=serialized_rows,
            row_count=len(raw_rows),
            execution_time_ms=exec_ms
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query Execution Error: {str(e)}")
