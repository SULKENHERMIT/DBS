from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth import get_current_user
from app.database import get_database
from app.models.transaction import TransactionCreate, TransactionResponse
from app.services.audit_service import log_user_action

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED, summary="Record Transaction")
async def record_transaction(
    tx_data: TransactionCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Record a buy, sell, or transfer transaction for a portfolio.
    """
    db = get_database()
    user_id = str(current_user["_id"])

    # Verify portfolio ownership
    try:
        port_id = ObjectId(tx_data.portfolio_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid portfolio_id")

    portfolio = await db.portfolios.find_one({"_id": port_id, "user_id": user_id})
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found or access denied")

    doc = tx_data.model_dump()
    doc["user_id"] = user_id
    doc["symbol"] = tx_data.symbol.strip().upper()
    doc["type"] = tx_data.type.strip().upper()
    doc["timestamp"] = datetime.now(timezone.utc)

    result = await db.transactions.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    await log_user_action(user_id, f"RECORDED_TRANSACTION:{doc['_id']}")
    return doc

@router.get("", response_model=List[TransactionResponse], summary="List User Transactions")
async def list_transactions(
    portfolio_id: Optional[str] = Query(None, description="Filter by portfolio ID"),
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    current_user: dict = Depends(get_current_user)
):
    """
    List transactions belonging to the authenticated user.
    """
    db = get_database()
    user_id = str(current_user["_id"])

    query = {"user_id": user_id}
    if portfolio_id:
        query["portfolio_id"] = portfolio_id
    if symbol:
        query["symbol"] = symbol.strip().upper()

    cursor = db.transactions.find(query).sort("timestamp", -1).limit(100)
    txs = await cursor.to_list(length=100)
    for t in txs:
        t["_id"] = str(t["_id"])
    return txs
