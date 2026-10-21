from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.db import fetch_all, fetch_one, fetch_val
from app.models import MarketSummaryResponse, WatchlistItem

router = APIRouter(prefix="/market", tags=["Market Overview"])

@router.get("/summary", response_model=MarketSummaryResponse)
async def get_market_summary():
    try:
        # Aggregated stats from ticker_stats
        totals_row = await fetch_one("""
            SELECT 
                count(t.asset_id) AS tracked_assets,
                coalesce(sum(t.volume_24h), 0) AS total_volume,
                max(t.updated_at) AS latest_update
            FROM ticker_stats t;
        """)

        # Calculate 24h price changes from hypertable using TimescaleDB first() and last()
        changes_rows = await fetch_all("""
            SELECT 
                symbol,
                round(((last(price, timestamp) - first(price, timestamp)) / nullif(first(price, timestamp), 0) * 100.0)::numeric, 2)::float AS change_24h
            FROM price_history
            WHERE timestamp >= (SELECT max(timestamp) - INTERVAL '24 hours' FROM price_history)
            GROUP BY symbol
            ORDER BY change_24h DESC;
        """)

        top_gainer = None
        top_loser = None

        if changes_rows:
            # Gainer is first (DESC), Loser is last
            best = changes_rows[0]
            worst = changes_rows[-1]

            best_asset = await fetch_one("""
                SELECT a.symbol, a.name, a.type, t.price_per_unit::float AS price_per_unit
                FROM assets a
                JOIN ticker_stats t USING (asset_id)
                WHERE a.symbol = $1;
            """, best["symbol"])
            if best_asset:
                top_gainer = {**dict(best_asset), "change_24h": best["change_24h"]}

            worst_asset = await fetch_one("""
                SELECT a.symbol, a.name, a.type, t.price_per_unit::float AS price_per_unit
                FROM assets a
                JOIN ticker_stats t USING (asset_id)
                WHERE a.symbol = $1;
            """, worst["symbol"])
            if worst_asset:
                top_loser = {**dict(worst_asset), "change_24h": worst["change_24h"]}

        # Active alerts count
        active_alerts = await fetch_val("SELECT count(*) FROM alerts WHERE enabled = true;") or 0

        # Total tick observations in hypertable
        total_ticks = await fetch_val("SELECT count(*) FROM price_history;") or 0

        return MarketSummaryResponse(
            tracked_assets_count=int(totals_row["tracked_assets"]) if totals_row else 0,
            total_volume_24h=float(totals_row["total_volume"]) if totals_row else 0.0,
            top_gainer=top_gainer,
            top_loser=top_loser,
            active_alerts_count=int(active_alerts),
            total_observations_count=int(total_ticks),
            latest_update=totals_row["latest_update"] if totals_row else None,
            data_notice="TimescaleDB historical market dataset (stored tick observations)"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch market summary: {str(e)}")

@router.get("/watchlist", response_model=List[WatchlistItem])
async def get_market_watchlist(asset_type: Optional[str] = Query(None, description="Filter by crypto or stock")):
    try:
        # Calculate 24h change using native TimescaleDB first() and last()
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
                coalesce(t.price_per_unit, 0.0)::float AS price,
                coalesce(t.volume_24h, 0.0)::float AS volume_24h,
                coalesce(pc.change_24h, 0.0)::float AS change_24h,
                coalesce(t.high_24h, 0.0)::float AS high_24h,
                coalesce(t.low_24h, 0.0)::float AS low_24h,
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

        watchlist: List[WatchlistItem] = []
        for row in rows:
            symbol = row["symbol"]
            spark_rows = await fetch_all("""
                SELECT price::float AS price
                FROM price_history
                WHERE symbol = $1
                ORDER BY timestamp DESC
                LIMIT 20;
            """, symbol)

            sparkline = [float(s["price"]) for s in reversed(spark_rows)]

            watchlist.append(WatchlistItem(
                asset_id=row["asset_id"],
                symbol=row["symbol"],
                name=row["name"],
                type=row["type"],
                price=float(row["price"]),
                volume_24h=float(row["volume_24h"]),
                change_24h=float(row["change_24h"]),
                high_24h=float(row["high_24h"]),
                low_24h=float(row["low_24h"]),
                updated_at=row["updated_at"],
                sparkline=sparkline
            ))

        return watchlist
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch watchlist: {str(e)}")
