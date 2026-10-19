from datetime import datetime, timezone
from typing import List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user
from app.database import get_database
from app.models.alert import AlertCreate, AlertResponse, NotificationResponse
from app.services.audit_service import log_user_action

router = APIRouter(prefix="/alerts", tags=["Alerts & Notifications"])

@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED, summary="Create Price Alert")
async def create_alert(
    alert_data: AlertCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Set a target price alert for an asset (ABOVE / BELOW threshold).
    """
    db = get_database()
    user_id = str(current_user["_id"])

    direction = alert_data.direction.strip().upper()
    if direction not in ["ABOVE", "BELOW"]:
        raise HTTPException(status_code=400, detail="Direction must be 'ABOVE' or 'BELOW'")

    doc = {
        "user_id": user_id,
        "symbol": alert_data.symbol.strip().upper(),
        "asset_id": alert_data.asset_id,
        "threshold": float(alert_data.threshold),
        "direction": direction,
        "enabled": alert_data.enabled,
        "triggered_at": None,
        "created_at": datetime.now(timezone.utc)
    }

    result = await db.alerts.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    await log_user_action(user_id, f"CREATED_ALERT:{doc['_id']}:{doc['symbol']}")
    return doc

@router.get("", response_model=List[AlertResponse], summary="List User Alerts")
async def list_alerts(current_user: dict = Depends(get_current_user)):
    """
    List price alerts configured by the user.
    """
    db = get_database()
    user_id = str(current_user["_id"])

    cursor = db.alerts.find({"user_id": user_id}).sort("created_at", -1)
    alerts = await cursor.to_list(length=100)
    for a in alerts:
        a["_id"] = str(a["_id"])
    return alerts

@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Alert")
async def delete_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a price alert.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    try:
        obj_id = ObjectId(alert_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid alert_id")

    res = await db.alerts.delete_one({"_id": obj_id, "user_id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return None

@router.get("/notifications", response_model=List[NotificationResponse], summary="List Triggered Notifications")
async def list_notifications(current_user: dict = Depends(get_current_user)):
    """
    List triggered notifications for the user.
    """
    db = get_database()
    user_id = str(current_user["_id"])

    cursor = db.notifications.find({"user_id": user_id}).sort("sent_at", -1).limit(50)
    notifications = await cursor.to_list(length=50)
    for n in notifications:
        n["_id"] = str(n["_id"])
    return notifications
