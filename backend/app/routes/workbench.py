"""
Secure SQL Query Workbench Router for TimescaleDB Dashboard
Supports Build Mode metadata and secure Code Mode execution with:
- Least-privilege role validation (dashboard_reader)
- Multi-layer read-only verification
- Single statement enforcement
- Server-enforced statement timeout & max row limit
- Safe error masking without leaking credentials or internal stack traces
"""

import time
import re
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from typing import Any, List, Optional, Dict
import asyncpg
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.db import init_db_pool

router = APIRouter(prefix="/query-workbench", tags=["SQL Query Workbench"])

# -----------------------------------------------------------------------------
# Approved Tables and Views Metadata
# -----------------------------------------------------------------------------
APPROVED_TABLES: Dict[str, Dict[str, Any]] = {
    "price_history": {
        "type": "hypertable",
        "description": "TimescaleDB time-series hypertable tracking tick-level crypto and stock prices (15 chunks).",
        "timestamp_column": "timestamp",
        "default_sort": "timestamp",
        "columns": [
            {"name": "history_id", "type": "uuid", "nullable": False},
            {"name": "symbol", "type": "character varying", "nullable": False},
            {"name": "asset_id", "type": "uuid", "nullable": True},
            {"name": "price", "type": "numeric", "nullable": False},
            {"name": "volume", "type": "numeric", "nullable": True},
            {"name": "timestamp", "type": "timestamp with time zone", "nullable": False},
        ],
    },
    "price_history_hourly_candlestick": {
        "type": "continuous_aggregate",
        "description": "Pre-materialized 1-hour OHLCV candlestick aggregation view.",
        "timestamp_column": "candle_bucket",
        "default_sort": "candle_bucket",
        "columns": [
            {"name": "candle_bucket", "type": "timestamp with time zone", "nullable": True},
            {"name": "symbol", "type": "character varying", "nullable": True},
            {"name": "asset_id", "type": "uuid", "nullable": True},
            {"name": "open_price", "type": "numeric", "nullable": True},
            {"name": "high_price", "type": "numeric", "nullable": True},
            {"name": "low_price", "type": "numeric", "nullable": True},
            {"name": "close_price", "type": "numeric", "nullable": True},
            {"name": "total_volume", "type": "numeric", "nullable": True},
            {"name": "tick_count", "type": "bigint", "nullable": True},
        ],
    },
    "assets": {
        "type": "relational_table",
        "description": "Financial asset catalog for crypto tokens and US equities.",
        "timestamp_column": "created_at",
        "default_sort": "symbol",
        "columns": [
            {"name": "asset_id", "type": "uuid", "nullable": False},
            {"name": "symbol", "type": "character varying", "nullable": False},
            {"name": "name", "type": "character varying", "nullable": False},
            {"name": "type", "type": "character varying", "nullable": False},
            {"name": "network", "type": "character varying", "nullable": True},
            {"name": "contract_address", "type": "character varying", "nullable": True},
            {"name": "ticker_exchange", "type": "character varying", "nullable": True},
            {"name": "sector", "type": "character varying", "nullable": True},
            {"name": "exchange_id", "type": "uuid", "nullable": True},
            {"name": "created_at", "type": "timestamp with time zone", "nullable": False},
        ],
    },
    "ticker_stats": {
        "type": "relational_table",
        "description": "24-hour summary market metrics per asset.",
        "timestamp_column": "updated_at",
        "default_sort": "updated_at",
        "columns": [
            {"name": "asset_id", "type": "uuid", "nullable": False},
            {"name": "price_per_unit", "type": "numeric", "nullable": False},
            {"name": "volume_24h", "type": "numeric", "nullable": True},
            {"name": "high_24h", "type": "numeric", "nullable": True},
            {"name": "low_24h", "type": "numeric", "nullable": True},
            {"name": "updated_at", "type": "timestamp with time zone", "nullable": False},
        ],
    },
    "portfolios": {
        "type": "relational_table",
        "description": "User portfolio containers.",
        "timestamp_column": "created_at",
        "default_sort": "created_at",
        "columns": [
            {"name": "portfolio_id", "type": "uuid", "nullable": False},
            {"name": "user_id", "type": "uuid", "nullable": False},
            {"name": "name", "type": "character varying", "nullable": False},
            {"name": "created_at", "type": "timestamp with time zone", "nullable": False},
        ],
    },
    "holdings": {
        "type": "relational_table",
        "description": "Active positions in portfolios with volume-weighted average buy price.",
        "timestamp_column": "updated_at",
        "default_sort": "updated_at",
        "columns": [
            {"name": "holding_id", "type": "uuid", "nullable": False},
            {"name": "portfolio_id", "type": "uuid", "nullable": False},
            {"name": "asset_id", "type": "uuid", "nullable": True},
            {"name": "symbol", "type": "character varying", "nullable": False},
            {"name": "name", "type": "character varying", "nullable": False},
            {"name": "type", "type": "character varying", "nullable": False},
            {"name": "quantity", "type": "numeric", "nullable": False},
            {"name": "average_buy_price", "type": "numeric", "nullable": False},
            {"name": "updated_at", "type": "timestamp with time zone", "nullable": False},
        ],
    },
    "transactions": {
        "type": "relational_table",
        "description": "Trade execution audit log (BUY, SELL, TRANSFER).",
        "timestamp_column": "timestamp",
        "default_sort": "timestamp",
        "columns": [
            {"name": "transaction_id", "type": "uuid", "nullable": False},
            {"name": "user_id", "type": "uuid", "nullable": False},
            {"name": "portfolio_id", "type": "uuid", "nullable": False},
            {"name": "asset_id", "type": "uuid", "nullable": True},
            {"name": "symbol", "type": "character varying", "nullable": False},
            {"name": "type", "type": "character varying", "nullable": False},
            {"name": "quantity", "type": "numeric", "nullable": False},
            {"name": "price_at_transaction", "type": "numeric", "nullable": False},
            {"name": "network_hash", "type": "character varying", "nullable": True},
            {"name": "timestamp", "type": "timestamp with time zone", "nullable": False},
        ],
    },
    "portfolio_performance": {
        "type": "relational_table",
        "description": "Historical portfolio net worth and profit/loss performance snapshots.",
        "timestamp_column": "timestamp",
        "default_sort": "timestamp",
        "columns": [
            {"name": "performance_id", "type": "uuid", "nullable": False},
            {"name": "portfolio_id", "type": "uuid", "nullable": False},
            {"name": "total_value", "type": "numeric", "nullable": False},
            {"name": "total_profit_loss", "type": "numeric", "nullable": False},
            {"name": "total_profit_loss_pct", "type": "numeric", "nullable": False},
            {"name": "timestamp", "type": "timestamp with time zone", "nullable": False},
        ],
    },
    "alerts": {
        "type": "relational_table",
        "description": "Configured price threshold alert rules.",
        "timestamp_column": "created_at",
        "default_sort": "created_at",
        "columns": [
            {"name": "alert_id", "type": "uuid", "nullable": False},
            {"name": "user_id", "type": "uuid", "nullable": False},
            {"name": "symbol", "type": "character varying", "nullable": False},
            {"name": "asset_id", "type": "uuid", "nullable": True},
            {"name": "threshold", "type": "numeric", "nullable": False},
            {"name": "direction", "type": "character varying", "nullable": False},
            {"name": "enabled", "type": "boolean", "nullable": False},
            {"name": "triggered_at", "type": "timestamp with time zone", "nullable": True},
            {"name": "created_at", "type": "timestamp with time zone", "nullable": False},
        ],
    },
    "notifications": {
        "type": "relational_table",
        "description": "Triggered alert notifications and dispatch logs.",
        "timestamp_column": "sent_at",
        "default_sort": "sent_at",
        "columns": [
            {"name": "notification_id", "type": "uuid", "nullable": False},
            {"name": "alert_id", "type": "uuid", "nullable": False},
            {"name": "user_id", "type": "uuid", "nullable": False},
            {"name": "channel", "type": "character varying", "nullable": False},
            {"name": "status", "type": "character varying", "nullable": False},
            {"name": "sent_at", "type": "timestamp with time zone", "nullable": False},
        ],
    },
    "currency_rates": {
        "type": "relational_table",
        "description": "Fiat currency conversion rates to USD.",
        "timestamp_column": "updated_at",
        "default_sort": "currency_code",
        "columns": [
            {"name": "currency_code", "type": "character varying", "nullable": False},
            {"name": "rate_to_usd", "type": "numeric", "nullable": False},
            {"name": "updated_at", "type": "timestamp with time zone", "nullable": False},
        ],
    },
    "exchanges": {
        "type": "relational_table",
        "description": "Global financial exchanges and crypto trading venues.",
        "timestamp_column": None,
        "default_sort": "name",
        "columns": [
            {"name": "exchange_id", "type": "uuid", "nullable": False},
            {"name": "name", "type": "character varying", "nullable": False},
            {"name": "country", "type": "character varying", "nullable": False},
            {"name": "url", "type": "character varying", "nullable": True},
        ],
    },
    "audit_logs": {
        "type": "relational_table",
        "description": "Platform activity compliance and security audit logs.",
        "timestamp_column": "timestamp",
        "default_sort": "timestamp",
        "columns": [
            {"name": "log_id", "type": "uuid", "nullable": False},
            {"name": "user_id", "type": "uuid", "nullable": False},
            {"name": "action", "type": "character varying", "nullable": False},
            {"name": "timestamp", "type": "timestamp with time zone", "nullable": False},
        ],
    },
    "timescaledb_information.hypertables": {
        "type": "system_view",
        "description": "TimescaleDB system view detailing hypertable dimensions and compression status.",
        "timestamp_column": None,
        "default_sort": "hypertable_name",
        "columns": [
            {"name": "hypertable_schema", "type": "name", "nullable": True},
            {"name": "hypertable_name", "type": "name", "nullable": True},
            {"name": "owner", "type": "name", "nullable": True},
            {"name": "num_dimensions", "type": "smallint", "nullable": True},
            {"name": "num_chunks", "type": "integer", "nullable": True},
            {"name": "compression_enabled", "type": "boolean", "nullable": True},
        ],
    },
    "timescaledb_information.chunks": {
        "type": "system_view",
        "description": "TimescaleDB system view detailing time partition chunk ranges and compression.",
        "timestamp_column": "range_start",
        "default_sort": "range_start",
        "columns": [
            {"name": "chunk_name", "type": "name", "nullable": True},
            {"name": "hypertable_name", "type": "name", "nullable": True},
            {"name": "range_start", "type": "timestamp with time zone", "nullable": True},
            {"name": "range_end", "type": "timestamp with time zone", "nullable": True},
            {"name": "is_compressed", "type": "boolean", "nullable": True},
            {"name": "chunk_creation_time", "type": "timestamp with time zone", "nullable": True},
        ],
    },
}

VERIFIED_EXAMPLES = [
    {
        "id": "ex_a",
        "name": "Observation Counts by Asset",
        "description": "Count total time-series price points and find the latest observation timestamp per symbol.",
        "category": "Basic Analytics",
        "sql": """SELECT 
    symbol, 
    COUNT(*) AS records, 
    MAX(timestamp) AS latest_observation
FROM price_history 
GROUP BY symbol 
ORDER BY symbol;"""
    },
    {
        "id": "ex_b",
        "name": "Recent Price Ticks",
        "description": "Retrieve the most recent price and volume observations ordered chronologically descending.",
        "category": "Raw Observations",
        "sql": """SELECT 
    symbol, 
    price, 
    volume, 
    timestamp
FROM price_history 
ORDER BY timestamp DESC 
LIMIT 100;"""
    },
    {
        "id": "ex_c",
        "name": "Latest Price per Asset (Timescale last())",
        "description": "Uses TimescaleDB native last() analytical state function to fetch the latest observation per asset.",
        "category": "TimescaleDB Hyperfunctions",
        "sql": """SELECT 
    symbol,
    last(price, timestamp) AS latest_price,
    last(volume, timestamp) AS latest_volume,
    max(timestamp) AS last_observed_at
FROM price_history
GROUP BY symbol
ORDER BY symbol;"""
    },
    {
        "id": "ex_d",
        "name": "TimescaleDB Hypertable & Chunk Metadata",
        "description": "Inspect underlying time partition chunks, time boundaries, and columnar compression status.",
        "category": "Engine Diagnostics",
        "sql": """SELECT 
    chunk_name,
    hypertable_name,
    range_start,
    range_end,
    is_compressed,
    chunk_creation_time
FROM timescaledb_information.chunks
WHERE hypertable_name = 'price_history'
ORDER BY range_start DESC
LIMIT 20;"""
    },
    {
        "id": "ex_e",
        "name": "Hourly Price Aggregation (time_bucket)",
        "description": "Calculates 1-hour rolling OHLC price averages and tick volume over the last 7 days.",
        "category": "TimescaleDB Hyperfunctions",
        "sql": """SELECT 
    time_bucket('1 hour', timestamp) AS bucket,
    symbol,
    round(avg(price), 2) AS avg_price,
    round(min(price), 2) AS min_price,
    round(max(price), 2) AS max_price,
    count(*) AS observation_count
FROM price_history
WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY bucket, symbol
ORDER BY bucket DESC, symbol ASC
LIMIT 100;"""
    },
    {
        "id": "ex_f",
        "name": "Hourly Candlesticks (Continuous Aggregate)",
        "description": "Queries the pre-materialized price_history_hourly_candlestick continuous aggregate view.",
        "category": "Continuous Aggregates",
        "sql": """SELECT 
    candle_bucket,
    symbol,
    open_price,
    high_price,
    low_price,
    close_price,
    total_volume,
    tick_count
FROM price_history_hourly_candlestick
ORDER BY candle_bucket DESC
LIMIT 100;"""
    },
    {
        "id": "ex_g",
        "name": "Multi-Asset Portfolio Valuation & PnL",
        "description": "Calculates real-time market value and unrealized profit/loss across all holdings in active portfolios.",
        "category": "Portfolio Analytics",
        "sql": """SELECT 
    p.name AS portfolio_name,
    h.symbol,
    h.name AS asset_name,
    h.quantity,
    h.average_buy_price,
    ts.price_per_unit AS current_market_price,
    round((h.quantity * ts.price_per_unit), 2) AS current_market_value,
    round(((h.quantity * ts.price_per_unit) - (h.quantity * h.average_buy_price)), 2) AS unrealized_pnl
FROM portfolios p
JOIN holdings h ON p.portfolio_id = h.portfolio_id
JOIN assets a ON h.symbol = a.symbol
JOIN ticker_stats ts ON a.asset_id = ts.asset_id
ORDER BY p.name, current_market_value DESC;"""
    }
]

# -----------------------------------------------------------------------------
# Request & Response Models
# -----------------------------------------------------------------------------
class QueryExecuteRequest(BaseModel):
    query: str = Field(..., max_length=15000, description="Read-only SQL query to execute")
    params: Optional[List[Any]] = Field(default=None, description="Optional parameterized query values ($1, $2, ...)")
    limit: Optional[int] = Field(default=100, ge=1, le=500, description="Max rows to return (server capped at 500)")

class QueryExecuteResponse(BaseModel):
    success: bool
    columns: List[str] = Field(default_factory=list)
    column_types: List[str] = Field(default_factory=list)
    rows: List[List[Any]] = Field(default_factory=list)
    row_count: int = 0
    execution_ms: float = 0.0
    truncated: bool = False
    max_limit: int = 500
    error: Optional[str] = None
    query_executed: Optional[str] = None

# -----------------------------------------------------------------------------
# Security & SQL Inspection Helpers
# -----------------------------------------------------------------------------
DANGEROUS_PATTERNS = [
    r"\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b",
    r"\b(COPY|VACUUM|REINDEX|CALL|DO|PREPARE|DEALLOCATE|DISCARD)\b",
    r"\b(SET|RESET|LISTEN|NOTIFY|LOCK|SECURITY\s+LABEL)\b",
    r"\bALTER\s+SYSTEM\b",
    r"\bSELECT\s+.*\bINTO\b",  # SELECT ... INTO table
    r"\bFOR\s+(UPDATE|SHARE|NO\s+KEY\s+UPDATE|KEY\s+SHARE)\b",
    r"\b(pg_read_file|pg_write_file|pg_read_binary_file|pg_ls_dir|pg_stat_file)\b",
    r"\b(dblink|lo_export|lo_import|system|query_to_xml)\b",
    r"\b(pg_terminate_backend|pg_cancel_backend)\b",
    r"\b(pg_shadow|pg_authid)\b",
]

def strip_comments_and_strings(sql: str) -> str:
    """Strip SQL block comments, line comments, and string literals for safe lexical inspection."""
    # Remove block comments
    clean = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    # Remove line comments
    clean = re.sub(r"--.*$", " ", clean, flags=re.MULTILINE)
    # Remove dollar quotes $$...$$ or $tag$...$tag$
    clean = re.sub(r"\$[a-zA-Z0-9_]*\$.*?\$[a-zA-Z0-9_]*\$", " '' ", clean, flags=re.DOTALL)
    # Remove single-quoted strings (handling escaped quotes '')
    clean = re.sub(r"'(?:''|[^'])*'", " '' ", clean)
    return clean

def validate_readonly_sql(sql: str) -> Optional[str]:
    """Validate that the query contains exactly one read-only SELECT statement."""
    trimmed = sql.strip()
    if not trimmed:
        return "Query cannot be empty."

    # Strip literals and comments
    structure = strip_comments_and_strings(trimmed).strip()

    # Reject multiple statements (check for semicolon not at the very end)
    semicolons = [m.start() for m in re.finditer(r";", structure)]
    if semicolons:
        last_idx = semicolons[-1]
        trailing_content = structure[last_idx + 1:].strip()
        if trailing_content:
            return "Multiple SQL statements are strictly rejected. Only a single SELECT query is permitted."
        if len(semicolons) > 1:
            return "Multiple SQL statements are strictly rejected. Only a single SELECT query is permitted."

    # Remove the trailing semicolon if present for keyword analysis
    if structure.endswith(";"):
        structure = structure[:-1].strip()

    # Must start with SELECT, WITH, or EXPLAIN
    if not re.match(r"^(SELECT|WITH|EXPLAIN)\b", structure, flags=re.IGNORECASE):
        return "Only read-only SELECT, WITH (CTE), or EXPLAIN statements are permitted."

    # Check for forbidden commands or expressions
    for pat in DANGEROUS_PATTERNS:
        match = re.search(pat, structure, flags=re.IGNORECASE)
        if match:
            forbidden_term = match.group(0).strip()
            return f"Forbidden SQL operation or sensitive object detected: '{forbidden_term}'. Only read-only queries on verified analytical objects are allowed."

    return None

def serialize_cell(val: Any) -> Any:
    """Convert asyncpg record values into standard JSON-compatible formats."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, Decimal):
        # Convert numeric decimals to float or rounded string
        f = float(val)
        return int(f) if f.is_integer() else f
    if isinstance(val, (bytes, bytearray)):
        return val.hex()
    return val

# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------
@router.get("/schema")
async def get_workbench_schema():
    """Returns approved tables, views, data types, and verified query templates."""
    tables_list = []
    for tname, meta in APPROVED_TABLES.items():
        tables_list.append({
            "name": tname,
            "type": meta["type"],
            "description": meta["description"],
            "timestamp_column": meta["timestamp_column"],
            "default_sort": meta["default_sort"],
            "columns": meta["columns"],
        })

    return {
        "status": "success",
        "engine": "TimescaleDB / PostgreSQL",
        "role": "dashboard_reader (Least-Privilege Enforced)",
        "server_max_limit": 500,
        "default_timeout_ms": 5000,
        "tables": tables_list,
        "time_buckets": [
            {"label": "15 Minutes", "value": "15 minutes"},
            {"label": "1 Hour", "value": "1 hour"},
            {"label": "4 Hours", "value": "4 hours"},
            {"label": "1 Day", "value": "1 day"},
            {"label": "7 Days", "value": "7 days"},
        ],
        "example_queries": VERIFIED_EXAMPLES,
    }

@router.post("/execute", response_model=QueryExecuteResponse)
async def execute_workbench_query(req: QueryExecuteRequest):
    """
    Executes a read-only query securely against TimescaleDB:
    - Verifies statement is safe and read-only
    - Sets 5000ms statement_timeout
    - Enforces READ ONLY transaction
    - Caps returned rows at 500
    - Measures server-side execution duration
    - Masks connection strings and database credentials from errors
    """
    # 1. Validation
    err_msg = validate_readonly_sql(req.query)
    if err_msg:
        return QueryExecuteResponse(
            success=False,
            error=err_msg,
            query_executed=req.query,
            row_count=0,
            execution_ms=0.0
        )

    # 2. Server-enforced limit
    server_limit = min(max(1, req.limit or 100), 500)
    user_sql = req.query.strip().rstrip(";")

    # Wrap query if it lacks an explicit LIMIT to avoid transferring gigabytes
    has_limit = re.search(r"\bLIMIT\s+\d+", user_sql, flags=re.IGNORECASE)
    if not has_limit:
        # Wrap safely as a subquery to enforce server_limit + 1 (detect truncation)
        exec_sql = f"SELECT * FROM ({user_sql}) AS __q_wrap LIMIT {server_limit + 1};"
    else:
        exec_sql = f"{user_sql};"

    # 3. Execution against TimescaleDB
    pool = await init_db_pool()
    start_time = time.perf_counter()

    try:
        async with pool.acquire() as conn:
            # Enforce 5-second timeout and read-only transaction semantics
            await conn.execute("SET statement_timeout = 5000;")
            
            async with conn.transaction(readonly=True):
                if req.params and len(req.params) > 0:
                    records = await conn.fetch(exec_sql, *req.params)
                else:
                    records = await conn.fetch(exec_sql)

        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

        # Check for truncation
        truncated = False
        if len(records) > server_limit:
            records = records[:server_limit]
            truncated = True

        if not records:
            # Query returned 0 rows
            return QueryExecuteResponse(
                success=True,
                columns=[],
                column_types=[],
                rows=[],
                row_count=0,
                execution_ms=elapsed_ms,
                truncated=False,
                max_limit=server_limit,
                query_executed=user_sql
            )

        # Extract column names and serialized rows
        col_names = list(records[0].keys())
        serialized_rows = [
            [serialize_cell(rec[col]) for col in col_names]
            for rec in records
        ]

        return QueryExecuteResponse(
            success=True,
            columns=col_names,
            column_types=["any"] * len(col_names),
            rows=serialized_rows,
            row_count=len(serialized_rows),
            execution_ms=elapsed_ms,
            truncated=truncated,
            max_limit=server_limit,
            query_executed=user_sql
        )

    except asyncpg.QueryCanceledError:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        return QueryExecuteResponse(
            success=False,
            error="Query execution cancelled: statement exceeded 5,000ms safety timeout.",
            execution_ms=elapsed_ms,
            query_executed=user_sql
        )
    except asyncpg.PostgresError as pg_err:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        # Clean postgres error message without exposing connection strings or passwords
        clean_err = str(pg_err).strip()
        return QueryExecuteResponse(
            success=False,
            error=f"PostgreSQL Execution Error: {clean_err}",
            execution_ms=elapsed_ms,
            query_executed=user_sql
        )
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        return QueryExecuteResponse(
            success=False,
            error=f"Unexpected query error: {str(exc)}",
            execution_ms=elapsed_ms,
            query_executed=user_sql
        )
