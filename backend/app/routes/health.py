from fastapi import APIRouter, HTTPException
from app.db import fetch_one, fetch_val
from app.models import HealthResponse, SystemStatusResponse
from app.config import settings
from datetime import datetime

router = APIRouter(tags=["Health & System"])

@router.get("/health", response_model=HealthResponse)
async def get_health():
    try:
        row = await fetch_one("SELECT version(), now() AS server_time;")
        if not row:
            raise HTTPException(status_code=503, detail="Database unresponsive")
        
        version_str = row["version"]
        server_time = row["server_time"]
        
        # Check TimescaleDB extension version
        ext_row = await fetch_one("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';")
        ext_ver = ext_row["extversion"] if ext_row else "Installed"

        return HealthResponse(
            status="healthy",
            database="connected",
            database_engine=f"TimescaleDB {ext_ver}",
            version=version_str.split("on")[0].strip(),
            server_time=server_time
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database health check failed: {str(e)}")

@router.get("/system/status", response_model=SystemStatusResponse)
async def get_system_status():
    try:
        # Version and user
        ver_row = await fetch_one("SELECT version(), current_user, current_database();")
        
        # TimescaleDB chunks info
        chunks_count = await fetch_val(
            "SELECT count(*) FROM timescaledb_information.chunks WHERE hypertable_name = 'price_history';"
        ) or 0
        
        comp_chunks_count = await fetch_val(
            "SELECT count(*) FROM timescaledb_information.chunks WHERE hypertable_name = 'price_history' AND is_compressed = true;"
        ) or 0
        
        # Observation bounds and total count
        ticks_row = await fetch_one(
            "SELECT count(*) AS total_ticks, min(timestamp) AS earliest, max(timestamp) AS latest FROM price_history;"
        )
        
        # Assets count
        assets_count = await fetch_val("SELECT count(*) FROM assets;") or 0

        return SystemStatusResponse(
            database_connected=True,
            database_engine="TimescaleDB / PostgreSQL 16",
            database_version=ver_row["version"].split("on")[0].strip() if ver_row else "PostgreSQL 16",
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            database_name=ver_row["current_database"] if ver_row else settings.DB_NAME,
            authenticated_user=ver_row["current_user"] if ver_row else settings.DB_USER,
            total_hypertable_chunks=int(chunks_count),
            compressed_chunks=int(comp_chunks_count),
            total_price_ticks=int(ticks_row["total_ticks"]) if ticks_row else 0,
            earliest_observation=ticks_row["earliest"] if ticks_row else None,
            latest_observation=ticks_row["latest"] if ticks_row else None,
            tracked_assets_count=int(assets_count),
            data_source_mode="TimescaleDB Hypertable price_history (1-Day Partitioned Chunks)"
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"System status query failed: {str(e)}")
