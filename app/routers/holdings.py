from datetime import datetime, timezone
from typing import List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user
from app.database import get_database
from app.models.portfolio import (
    HoldingCreate, HoldingResponse, HoldingUpdate, HoldingValuationResponse
)
from app.services.audit_service import log_user_action
from app.services.price_service import PriceService

router = APIRouter(prefix="/portfolios/{portfolio_id}/holdings", tags=["Holdings"])

def parse_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ID format: '{id_str}'"
        )

@router.post("", response_model=HoldingResponse, status_code=status.HTTP_201_CREATED, summary="Add Holding to Portfolio")
async def add_holding(
    portfolio_id: str,
    holding_data: HoldingCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a new holding (cryptocurrency or stock) to a user's portfolio.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    obj_portfolio_id = parse_object_id(portfolio_id)

    # Verify portfolio ownership
    portfolio = await db.portfolios.find_one({"_id": obj_portfolio_id, "user_id": user_id})
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found or access denied"
        )

    holding_id = str(ObjectId())
    clean_type = holding_data.type.strip().lower()
    if clean_type not in ["crypto", "stock"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Holding type must be either 'crypto' or 'stock'"
        )

    new_holding = {
        "_id": holding_id,
        "symbol": holding_data.symbol.strip().upper(),
        "name": holding_data.name.strip() if holding_data.name else holding_data.symbol.strip().upper(),
        "type": clean_type,
        "quantity": float(holding_data.quantity),
        "average_buy_price": float(holding_data.average_buy_price),
        "asset_id": holding_data.asset_id,
        "updated_at": datetime.now(timezone.utc)
    }

    # Embed holding into portfolio document atomically
    await db.portfolios.update_one(
        {"_id": obj_portfolio_id, "user_id": user_id},
        {"$push": {"holdings": new_holding}}
    )

    await log_user_action(user_id, f"ADDED_HOLDING:{holding_id}:IN_PORTFOLIO:{portfolio_id}")

    return new_holding

@router.get("", response_model=List[HoldingResponse], summary="List Holdings in Portfolio")
async def list_holdings(
    portfolio_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve all holdings within a specific portfolio.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    obj_portfolio_id = parse_object_id(portfolio_id)

    portfolio = await db.portfolios.find_one({"_id": obj_portfolio_id, "user_id": user_id})
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found or access denied"
        )

    holdings = portfolio.get("holdings", [])
    for h in holdings:
        h["_id"] = str(h.get("_id", ""))

    return holdings

@router.get("/{holding_id}", response_model=HoldingResponse, summary="Get Holding by ID")
async def get_holding(
    portfolio_id: str,
    holding_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a single holding from the portfolio.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    obj_portfolio_id = parse_object_id(portfolio_id)

    portfolio = await db.portfolios.find_one({"_id": obj_portfolio_id, "user_id": user_id})
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found or access denied"
        )

    holdings = portfolio.get("holdings", [])
    for h in holdings:
        if str(h.get("_id")) == holding_id:
            h["_id"] = str(h["_id"])
            return h

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found in portfolio")

@router.put("/{holding_id}", response_model=HoldingResponse, summary="Update Holding")
async def update_holding(
    portfolio_id: str,
    holding_id: str,
    update_data: HoldingUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update quantity, average buy price, or name for an existing holding.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    obj_portfolio_id = parse_object_id(portfolio_id)

    portfolio = await db.portfolios.find_one({"_id": obj_portfolio_id, "user_id": user_id})
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found or access denied")

    target_holding = None
    for h in portfolio.get("holdings", []):
        if str(h.get("_id")) == holding_id:
            target_holding = h
            break

    if not target_holding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found in portfolio")

    # Prepare update fields
    set_dict = {"holdings.$.updated_at": datetime.now(timezone.utc)}
    if update_data.quantity is not None:
        set_dict["holdings.$.quantity"] = float(update_data.quantity)
        target_holding["quantity"] = float(update_data.quantity)
    if update_data.average_buy_price is not None:
        set_dict["holdings.$.average_buy_price"] = float(update_data.average_buy_price)
        target_holding["average_buy_price"] = float(update_data.average_buy_price)
    if update_data.name is not None:
        set_dict["holdings.$.name"] = update_data.name.strip()
        target_holding["name"] = update_data.name.strip()

    await db.portfolios.update_one(
        {"_id": obj_portfolio_id, "user_id": user_id, "holdings._id": holding_id},
        {"$set": set_dict}
    )

    await log_user_action(user_id, f"UPDATED_HOLDING:{holding_id}:IN_PORTFOLIO:{portfolio_id}")

    target_holding["_id"] = str(target_holding["_id"])
    return target_holding

@router.delete("/{holding_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Holding")
async def delete_holding(
    portfolio_id: str,
    holding_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Remove a holding from a portfolio.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    obj_portfolio_id = parse_object_id(portfolio_id)

    res = await db.portfolios.update_one(
        {"_id": obj_portfolio_id, "user_id": user_id},
        {"$pull": {"holdings": {"_id": holding_id}}}
    )

    if res.matched_count == 0 or res.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding or portfolio not found")

    await log_user_action(user_id, f"DELETED_HOLDING:{holding_id}:FROM_PORTFOLIO:{portfolio_id}")
    return None

@router.get("/{holding_id}/valuation", response_model=HoldingValuationResponse, summary="Get Holding Live Valuation & Gain/Loss")
async def get_holding_valuation(
    portfolio_id: str,
    holding_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns a holding's current value and gain/loss using live price data
    (from CoinGecko for crypto or Finnhub for stocks, cached in MongoDB PriceCache for 5 minutes).
    """
    db = get_database()
    user_id = str(current_user["_id"])
    obj_portfolio_id = parse_object_id(portfolio_id)

    portfolio = await db.portfolios.find_one({"_id": obj_portfolio_id, "user_id": user_id})
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found or access denied")

    holdings = portfolio.get("holdings", [])
    target_holding = None
    for h in holdings:
        if str(h.get("_id")) == holding_id:
            target_holding = h
            break

    if not target_holding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found in portfolio")

    try:
        valuation = await PriceService.evaluate_holding(target_holding)
        return valuation
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to calculate live valuation for {target_holding.get('symbol')}: {str(e)}"
        )
