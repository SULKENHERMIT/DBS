import asyncpg
import logging
from typing import Any, List, Optional, Dict
from app.config import settings

logger = logging.getLogger("timescale_dashboard.db")

pool: Optional[asyncpg.Pool] = None

async def init_db_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        logger.info(f"Connecting to TimescaleDB at {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME} as {settings.DB_USER}")
        pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=2,
            max_size=10,
            command_timeout=60,
            max_inactive_connection_lifetime=300,
        )
        logger.info("TimescaleDB connection pool successfully initialized.")
    return pool

async def close_db_pool() -> None:
    global pool
    if pool is not None:
        logger.info("Closing TimescaleDB connection pool...")
        await pool.close()
        pool = None
        logger.info("TimescaleDB connection pool closed.")

async def fetch_all(query: str, *args: Any) -> List[Dict[str, Any]]:
    """Execute a read query and return all rows as a list of dictionaries."""
    if pool is None:
        raise RuntimeError("Database connection pool is not initialized.")
    async with pool.acquire() as conn:
        records = await conn.fetch(query, *args)
        return [dict(rec) for rec in records]

async def fetch_one(query: str, *args: Any) -> Optional[Dict[str, Any]]:
    """Execute a read query and return a single row as a dictionary or None."""
    if pool is None:
        raise RuntimeError("Database connection pool is not initialized.")
    async with pool.acquire() as conn:
        record = await conn.fetchrow(query, *args)
        return dict(record) if record else None

async def fetch_val(query: str, *args: Any) -> Any:
    """Execute a query returning a single scalar value."""
    if pool is None:
        raise RuntimeError("Database connection pool is not initialized.")
    async with pool.acquire() as conn:
        return await conn.fetchval(query, *args)
