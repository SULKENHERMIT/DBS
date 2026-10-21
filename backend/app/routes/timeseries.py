from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from app.db import fetch_all, fetch_one
from app.models import HypertableStatsResponse, ChunkItem

router = APIRouter(prefix="/timeseries", tags=["TimescaleDB Engine Diagnostics"])

@router.get("/hypertable-stats", response_model=HypertableStatsResponse)
async def get_hypertable_stats():
    try:
        # Call TimescaleDB compression stats function
        stats_row = await fetch_one("""
            SELECT 
                total_chunks,
                number_compressed_chunks AS compressed_chunks,
                before_compression_total_bytes AS uncompressed_bytes,
                after_compression_total_bytes AS compressed_bytes
            FROM hypertable_compression_stats('price_history');
        """)

        if not stats_row:
            # Fallback if no compression stats row
            chunks_total = await fetch_one("SELECT count(*) AS total FROM timescaledb_information.chunks WHERE hypertable_name = 'price_history';")
            return HypertableStatsResponse(
                hypertable_name="price_history",
                total_chunks=int(chunks_total["total"]) if chunks_total else 15,
                compressed_chunks=0,
                uncompressed_chunks=int(chunks_total["total"]) if chunks_total else 15,
                uncompressed_bytes=0,
                compressed_bytes=0,
                space_saved_bytes=0,
                space_saved_pct=0.0,
                compression_ratio=1.0
            )

        total_chunks = stats_row["total_chunks"] or 0
        comp_chunks = stats_row["compressed_chunks"] or 0
        uncompressed_chunks = total_chunks - comp_chunks
        uncomp_bytes = stats_row["uncompressed_bytes"] or 0
        comp_bytes = stats_row["compressed_bytes"] or 0

        saved_bytes = max(0, uncomp_bytes - comp_bytes)
        saved_pct = (saved_bytes / uncomp_bytes * 100.0) if uncomp_bytes > 0 else 0.0
        ratio = (uncomp_bytes / comp_bytes) if comp_bytes > 0 else 1.0

        return HypertableStatsResponse(
            hypertable_name="price_history",
            total_chunks=total_chunks,
            compressed_chunks=comp_chunks,
            uncompressed_chunks=uncompressed_chunks,
            uncompressed_bytes=uncomp_bytes,
            compressed_bytes=comp_bytes,
            space_saved_bytes=saved_bytes,
            space_saved_pct=round(saved_pct, 2),
            compression_ratio=round(ratio, 2)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch hypertable compression stats: {str(e)}")

@router.get("/chunks", response_model=List[ChunkItem])
async def list_hypertable_chunks():
    try:
        rows = await fetch_all("""
            SELECT 
                chunk_name,
                range_start,
                range_end,
                is_compressed,
                CASE WHEN is_compressed THEN 'Columnar Compressed' ELSE 'Raw Uncompressed' END AS compression_state
            FROM timescaledb_information.chunks
            WHERE hypertable_name = 'price_history'
            ORDER BY range_start DESC;
        """)
        return [ChunkItem(**r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch hypertable chunks: {str(e)}")

@router.get("/volume-comparison")
async def get_volume_comparison():
    try:
        # Sum volume by symbol from hourly continuous aggregates
        rows = await fetch_all("""
            SELECT 
                symbol,
                sum(total_volume)::float AS total_volume,
                sum(tick_count)::int AS total_ticks
            FROM price_history_hourly_candlestick
            GROUP BY symbol
            ORDER BY total_volume DESC;
        """)
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch volume comparison: {str(e)}")

@router.get("/daily-summary")
async def get_daily_summary(limit: int = Query(30, le=100)):
    try:
        # Dynamic rollup using TimescaleDB time_bucket('1 day', timestamp)
        rows = await fetch_all("""
            SELECT 
                to_char(time_bucket('1 day', timestamp), 'YYYY-MM-DD') AS bucket_date,
                symbol,
                first(price, timestamp)::float AS open_price,
                max(price)::float AS high_price,
                min(price)::float AS low_price,
                last(price, timestamp)::float AS close_price,
                sum(volume)::float AS total_volume,
                count(*)::int AS tick_count
            FROM price_history
            GROUP BY time_bucket('1 day', timestamp), symbol
            ORDER BY bucket_date DESC, symbol ASC
            LIMIT $1;
        """, limit)
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch daily rollup: {str(e)}")
