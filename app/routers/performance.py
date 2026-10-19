from datetime import datetime, timezone
from typing import List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user
from app.database import get_database
from app.models.performance import PortfolioPerformanceResponse, PortfolioPerformanceSnapshot
from app.routers.portfolios import get_portfolio_valuation
from app.services.audit_service import log_user_action

router = APIRouter(prefix="/portfolios/{portfolio_id}/performance", tags=["Portfolio Performance"])

@router.post("/snapshot", response_model=PortfolioPerformanceResponse, status_code=status.HTTP_201_CREATED, summary="Record Performance Snapshot")
async def record_performance_snapshot(
    portfolio_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Computes current valuation and saves a point-in-time snapshot into portfolio_performance collection.
    """
    db = get_database()
    user_id = str(current_user["_id"])

    # Compute current live valuation
    val = await get_portfolio_valuation(portfolio_id=portfolio_id, current_user=current_user)

    doc = {
        "portfolio_id": portfolio_id,
        "total_value": val["total_current_value"],
        "total_profit_loss": val["total_gain_loss"],
        "total_profit_loss_pct": val["total_gain_loss_pct"],
        "timestamp": datetime.now(timezone.utc)
    }

    result = await db.portfolio_performance.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    await log_user_action(user_id, f"RECORDED_PERFORMANCE_SNAPSHOT:{portfolio_id}")
    return doc

@router.get("", response_model=List[PortfolioPerformanceResponse], summary="List Performance Snapshots")
async def list_performance_snapshots(
    portfolio_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve historical performance timeline for a portfolio.
    """
    db = get_database()
    user_id = str(current_user["_id"])

    # Verify portfolio ownership
    try:
        obj_id = ObjectId(portfolio_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid portfolio_id")

    portfolio = await db.portfolios.find_one({"_id": obj_id, "user_id": user_id})
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found or access denied")

    cursor = db.portfolio_performance.find({"portfolio_id": portfolio_id}).sort("timestamp", -1).limit(100)
    snapshots = await cursor.to_list(length=100)
    for s in snapshots:
        s["_id"] = str(s["_id"])
    return snapshots
