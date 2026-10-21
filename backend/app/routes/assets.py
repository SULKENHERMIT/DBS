from fastapi import APIRouter, HTTPException, Query, Path
from typing import List, Optional
from datetime import datetime, timedelta
from app.db import fetch_all, fetch_one, fetch_val
from app.models import AssetDetail, PriceHistoryPoint, CandlePoint, AssetStatsResponse

router = APIRouter(prefix="/assets", tags=["Asset Analytics"])

@router.get("", response_model=List[AssetDetail])
async def list_assets(asset_type: Optional[str] = Query(None)):
    try:
        query = """
            WITH price_changes AS (
                SELECT 
                    symbol,
                    round(((last(price, timestamp) - first(price, timestamp)) / nullif(first(price, timestamp), 0) * 100.0)::numeric, 2)::float AS change_24h
                FROM price_history
                WHERE timestamp >= (SELECT max(timestamp) - INTERVAL '24 hours' FROM price_history)
                GROUP BY symbol
            )
            SELECT 
                a.asset_id,
                a.symbol,
                a.name,
                a.type,
                a.network,
                a.sector,
                a.ticker_exchange,
                t.price_per_unit::float AS current_price,
                t.volume_24h::float AS volume_24h,
                coalesce(pc.change_24h, 0.0)::float AS change_24h,
                t.high_24h::float AS high_24h,
                t.low_24h::float AS low_24h,
                t.updated_at
            FROM assets a
            LEFT JOIN ticker_stats t ON a.asset_id = t.asset_id
            LEFT JOIN price_changes pc ON a.symbol = pc.symbol
        """
        params = []
        if asset_type:
            query += " WHERE a.type = $1"
            params.append(asset_type.lower())
        query += " ORDER BY a.symbol ASC;"

        rows = await fetch_all(query, *params)
        return [AssetDetail(**row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list assets: {str(e)}")

@router.get("/{symbol}", response_model=AssetDetail)
async def get_asset(symbol: str = Path(..., description="Asset symbol (e.g. BTC, ETH, AAPL)")):
    try:
        sym = symbol.upper()
        row = await fetch_one("""
            WITH price_changes AS (
                SELECT 
                    symbol,
                    round(((last(price, timestamp) - first(price, timestamp)) / nullif(first(price, timestamp), 0) * 100.0)::numeric, 2)::float AS change_24h
                FROM price_history
                WHERE symbol = $1 AND timestamp >= (SELECT max(timestamp) - INTERVAL '24 hours' FROM price_history WHERE symbol = $1)
                GROUP BY symbol
            )
            SELECT 
                a.asset_id,
                a.symbol,
                a.name,
                a.type,
                a.network,
                a.sector,
                a.ticker_exchange,
                t.price_per_unit::float AS current_price,
                t.volume_24h::float AS volume_24h,
                coalesce(pc.change_24h, 0.0)::float AS change_24h,
                t.high_24h::float AS high_24h,
                t.low_24h::float AS low_24h,
                t.updated_at
            FROM assets a
            LEFT JOIN ticker_stats t ON a.asset_id = t.asset_id
            LEFT JOIN price_changes pc ON a.symbol = pc.symbol
            WHERE a.symbol = $1;
        """, sym)
        if not row:
            raise HTTPException(status_code=404, detail=f"Asset '{sym}' not found in database catalog")
        return AssetDetail(**row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch asset: {str(e)}")

@router.get("/{symbol}/history", response_model=List[PriceHistoryPoint])
async def get_asset_history(
    symbol: str = Path(...),
    time_range: str = Query("7d", alias="range", description="Time range: 1h, 24h, 7d, 30d, all"),
    limit: int = Query(1000, le=5000, description="Max points to return")
):
    try:
        sym = symbol.upper()
        exists = await fetch_val("SELECT 1 FROM assets WHERE symbol = $1;", sym)
        if not exists:
            raise HTTPException(status_code=404, detail=f"Asset '{sym}' not found")

        max_ts = await fetch_val("SELECT max(timestamp) FROM price_history WHERE symbol = $1;", sym)
        if not max_ts:
            return []

        cutoff: Optional[datetime] = None
        if time_range == "1h":
            cutoff = max_ts - timedelta(hours=1)
        elif time_range == "24h":
            cutoff = max_ts - timedelta(hours=24)
        elif time_range == "7d":
            cutoff = max_ts - timedelta(days=7)
        elif time_range == "30d":
            cutoff = max_ts - timedelta(days=30)

        if cutoff is not None:
            query = """
                SELECT timestamp, price::float AS price, volume::float AS volume
                FROM price_history
                WHERE symbol = $1 AND timestamp >= $2
                ORDER BY timestamp ASC
                LIMIT $3;
            """
            rows = await fetch_all(query, sym, cutoff, limit)
        else:
            query = """
                SELECT timestamp, price::float AS price, volume::float AS volume
                FROM price_history
                WHERE symbol = $1
                ORDER BY timestamp ASC
                LIMIT $2;
            """
            rows = await fetch_all(query, sym, limit)

        return [PriceHistoryPoint(**row) for row in rows]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch price history: {str(e)}")

@router.get("/{symbol}/candles", response_model=List[CandlePoint])
async def get_asset_candles(
    symbol: str = Path(...),
    time_range: str = Query("7d", alias="range", description="Candle range: 24h, 7d, 30d, all"),
    limit: int = Query(300, le=1000)
):
    try:
        sym = symbol.upper()
        max_bucket = await fetch_val("SELECT max(candle_bucket) FROM price_history_hourly_candlestick WHERE symbol = $1;", sym)
        if not max_bucket:
            return []

        cutoff: Optional[datetime] = None
        if time_range == "24h":
            cutoff = max_bucket - timedelta(hours=24)
        elif time_range == "7d":
            cutoff = max_bucket - timedelta(days=7)
        elif time_range == "30d":
            cutoff = max_bucket - timedelta(days=30)

        if cutoff is not None:
            query = """
                SELECT 
                    candle_bucket,
                    open_price::float AS open_price,
                    high_price::float AS high_price,
                    low_price::float AS low_price,
                    close_price::float AS close_price,
                    coalesce(total_volume, 0)::float AS total_volume,
                    tick_count
                FROM price_history_hourly_candlestick
                WHERE symbol = $1 AND candle_bucket >= $2
                ORDER BY candle_bucket ASC
                LIMIT $3;
            """
            rows = await fetch_all(query, sym, cutoff, limit)
        else:
            query = """
                SELECT 
                    candle_bucket,
                    open_price::float AS open_price,
                    high_price::float AS high_price,
                    low_price::float AS low_price,
                    close_price::float AS close_price,
                    coalesce(total_volume, 0)::float AS total_volume,
                    tick_count
                FROM price_history_hourly_candlestick
                WHERE symbol = $1
                ORDER BY candle_bucket ASC
                LIMIT $2;
            """
            rows = await fetch_all(query, sym, limit)

        return [CandlePoint(**row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch hourly candlestick aggregates: {str(e)}")

@router.get("/{symbol}/stats", response_model=AssetStatsResponse)
async def get_asset_stats(
    symbol: str = Path(...),
    time_range: str = Query("7d", alias="range", description="Range: 24h, 7d, 30d, all")
):
    try:
        sym = symbol.upper()
        max_ts = await fetch_val("SELECT max(timestamp) FROM price_history WHERE symbol = $1;", sym)
        if not max_ts:
            raise HTTPException(status_code=404, detail=f"No price history available for {sym}")

        cutoff: Optional[datetime] = None
        if time_range == "24h":
            cutoff = max_ts - timedelta(hours=24)
        elif time_range == "7d":
            cutoff = max_ts - timedelta(days=7)
        elif time_range == "30d":
            cutoff = max_ts - timedelta(days=30)

        if cutoff is not None:
            stats = await fetch_one("""
                SELECT 
                    first(price, timestamp)::float AS start_price,
                    last(price, timestamp)::float AS latest_price,
                    max(price)::float AS high_price,
                    min(price)::float AS low_price,
                    coalesce(sum(volume), 0)::float AS total_volume,
                    count(*) AS observation_count
                FROM price_history
                WHERE symbol = $1 AND timestamp >= $2;
            """, sym, cutoff)
        else:
            stats = await fetch_one("""
                SELECT 
                    first(price, timestamp)::float AS start_price,
                    last(price, timestamp)::float AS latest_price,
                    max(price)::float AS high_price,
                    min(price)::float AS low_price,
                    coalesce(sum(volume), 0)::float AS total_volume,
                    count(*) AS observation_count
                FROM price_history
                WHERE symbol = $1;
            """, sym)

        if not stats or stats["start_price"] is None:
            raise HTTPException(status_code=404, detail="No price data in selected window")

        start_p = stats["start_price"]
        latest_p = stats["latest_price"]
        diff = latest_p - start_p
        pct = (diff / start_p * 100.0) if start_p > 0 else 0.0

        return AssetStatsResponse(
            symbol=sym,
            time_range=time_range,
            start_price=round(start_p, 4),
            latest_price=round(latest_p, 4),
            price_change=round(diff, 4),
            price_change_pct=round(pct, 2),
            high_price=round(stats["high_price"], 4),
            low_price=round(stats["low_price"], 4),
            total_volume=round(stats["total_volume"], 2),
            observation_count=int(stats["observation_count"])
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate asset statistics: {str(e)}")
