import asyncio
from datetime import datetime, timezone
from typing import List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user
from app.database import get_database
from app.models.portfolio import (
    PortfolioCreate, PortfolioResponse, PortfolioUpdate, PortfolioValuationSummary
)
from app.services.audit_service import log_user_action
from app.services.price_service import PriceService

router = APIRouter(prefix="/portfolios", tags=["Portfolios"])

def parse_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid portfolio ID format: '{id_str}'"
        )

@router.post("", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED, summary="Create Portfolio")
async def create_portfolio(
    portfolio_data: PortfolioCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new portfolio owned by the authenticated user.
    """
    db = get_database()
    user_id = str(current_user["_id"])

    new_portfolio = {
        "user_id": user_id,
        "name": portfolio_data.name.strip(),
        "created_at": datetime.now(timezone.utc),
        "holdings": []
    }

    result = await db.portfolios.insert_one(new_portfolio)
    portfolio_id = str(result.inserted_id)

    await log_user_action(user_id, f"CREATED_PORTFOLIO:{portfolio_id}")

    return {
        "_id": portfolio_id,
        "user_id": user_id,
        "name": new_portfolio["name"],
        "created_at": new_portfolio["created_at"],
        "holdings": []
    }

@router.get("", response_model=List[PortfolioResponse], summary="List User Portfolios")
async def list_portfolios(current_user: dict = Depends(get_current_user)):
    """
    List all portfolios belonging to the authenticated user.
    """
    db = get_database()
    user_id = str(current_user["_id"])

    cursor = db.portfolios.find({"user_id": user_id}).sort("created_at", -1)
    portfolios = await cursor.to_list(length=100)

    for p in portfolios:
        p["_id"] = str(p["_id"])
        for h in p.get("holdings", []):
            h["_id"] = str(h.get("_id", ""))

    return portfolios

@router.get("/{portfolio_id}", response_model=PortfolioResponse, summary="Get Portfolio by ID")
async def get_portfolio(
    portfolio_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve a specific portfolio. Scoped to the authenticated user.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    obj_id = parse_object_id(portfolio_id)

    portfolio = await db.portfolios.find_one({"_id": obj_id, "user_id": user_id})
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found or access denied"
        )

    portfolio["_id"] = str(portfolio["_id"])
    for h in portfolio.get("holdings", []):
        h["_id"] = str(h.get("_id", ""))

    return portfolio

@router.put("/{portfolio_id}", response_model=PortfolioResponse, summary="Update Portfolio")
async def update_portfolio(
    portfolio_id: str,
    update_data: PortfolioUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a portfolio's name. Scoped to the authenticated user.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    obj_id = parse_object_id(portfolio_id)

    update_fields = {}
    if update_data.name is not None:
        update_fields["name"] = update_data.name.strip()

    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields provided for update")

    result = await db.portfolios.find_one_and_update(
        {"_id": obj_id, "user_id": user_id},
        {"$set": update_fields},
        return_document=True
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found or access denied"
        )

    result["_id"] = str(result["_id"])
    for h in result.get("holdings", []):
        h["_id"] = str(h.get("_id", ""))

    await log_user_action(user_id, f"UPDATED_PORTFOLIO:{portfolio_id}")

    return result

@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Portfolio")
async def delete_portfolio(
    portfolio_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a portfolio and associated sub-resources. Scoped to authenticated user.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    obj_id = parse_object_id(portfolio_id)

    result = await db.portfolios.delete_one({"_id": obj_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found or access denied"
        )

    # Clean up associated transactions and performance records
    await db.transactions.delete_many({"portfolio_id": portfolio_id, "user_id": user_id})
    await db.portfolio_performance.delete_many({"portfolio_id": portfolio_id})

    await log_user_action(user_id, f"DELETED_PORTFOLIO:{portfolio_id}")
    return None

@router.get("/{portfolio_id}/valuation", response_model=PortfolioValuationSummary, summary="Get Portfolio Full Valuation")
async def get_portfolio_valuation(
    portfolio_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate full portfolio valuation, total invested, total current market value,
    and aggregate gain/loss across all holdings using live cached prices.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    obj_id = parse_object_id(portfolio_id)

    portfolio = await db.portfolios.find_one({"_id": obj_id, "user_id": user_id})
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found or access denied"
        )

    holdings = portfolio.get("holdings", [])
    valuation_tasks = [PriceService.evaluate_holding(h) for h in holdings]
    valuations = await asyncio.gather(*valuation_tasks, return_exceptions=True)

    valid_valuations = []
    total_invested = 0.0
    total_current_value = 0.0

    for idx, val in enumerate(valuations):
        if isinstance(val, Exception):
            # Fallback if external API error occurs for single holding
            h = holdings[idx]
            qty = float(h.get("quantity", 0))
            buy_p = float(h.get("average_buy_price", 0))
            inv = qty * buy_p
            fallback_val = {
                "id": str(h.get("_id", "")),
                "symbol": h.get("symbol", "").upper(),
                "name": h.get("name") or h.get("symbol", ""),
                "type": h.get("type", "stock"),
                "quantity": qty,
                "average_buy_price": buy_p,
                "total_invested": round(inv, 2),
                "current_price": buy_p,
                "current_value": round(inv, 2),
                "gain_loss": 0.0,
                "gain_loss_pct": 0.0,
                "price_source": "Fallback (API unavailable)",
                "cached": False,
                "price_updated_at": datetime.now(timezone.utc)
            }
            valid_valuations.append(fallback_val)
            total_invested += inv
            total_current_value += inv
        else:
            valid_valuations.append(val)
            total_invested += val["total_invested"]
            total_current_value += val["current_value"]

    total_gain_loss = round(total_current_value - total_invested, 2)
    total_gain_loss_pct = round((total_gain_loss / total_invested * 100), 2) if total_invested > 0 else 0.0

    return {
        "portfolio_id": str(portfolio["_id"]),
        "portfolio_name": portfolio.get("name", ""),
        "total_invested": round(total_invested, 2),
        "total_current_value": round(total_current_value, 2),
        "total_gain_loss": total_gain_loss,
        "total_gain_loss_pct": total_gain_loss_pct,
        "holdings_valuation": valid_valuations
    }
