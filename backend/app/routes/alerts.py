from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.db import fetch_all
from app.models import AlertItem, NotificationItem

router = APIRouter(tags=["Alerts & Notifications"])

@router.get("/alerts", response_model=List[AlertItem])
async def list_alerts(
    status: Optional[str] = Query(None, description="Filter by status: active, triggered, all"),
    symbol: Optional[str] = Query(None, description="Filter by asset symbol")
):
    try:
        query = """
            SELECT 
                al.alert_id,
                al.user_id,
                al.symbol,
                a.name AS asset_name,
                al.threshold::float AS threshold,
                al.direction,
                al.enabled,
                al.triggered_at,
                al.created_at,
                CASE WHEN al.enabled = true THEN 'Active' ELSE 'Triggered' END AS status_label
            FROM alerts al
            LEFT JOIN assets a ON al.asset_id = a.asset_id
            WHERE 1=1
        """
        params = []
        if status == "active":
            query += " AND al.enabled = true"
        elif status == "triggered":
            query += " AND al.enabled = false"

        if symbol:
            params.append(symbol.upper())
            query += f" AND al.symbol = ${len(params)}"

        query += " ORDER BY al.created_at DESC;"

        rows = await fetch_all(query, *params)
        return [AlertItem(**r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch alerts: {str(e)}")

@router.get("/notifications", response_model=List[NotificationItem])
async def list_notifications():
    try:
        query = """
            SELECT 
                n.notification_id,
                n.alert_id,
                al.symbol,
                al.threshold::float AS threshold,
                al.direction,
                n.channel,
                n.status,
                n.sent_at
            FROM notifications n
            JOIN alerts al ON n.alert_id = al.alert_id
            ORDER BY n.sent_at DESC;
        """
        rows = await fetch_all(query)
        return [NotificationItem(**r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch notifications: {str(e)}")
