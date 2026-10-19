from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth import get_current_user
from app.database import get_database
from app.models.asset import AssetCreate, AssetResponse, PriceQuoteResponse
from app.services.price_service import PriceService

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED, summary="Create Asset")
async def create_asset(
    asset_data: AssetCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Register an asset in the catalog (supporting crypto or stock specializations).
    """
    db = get_database()
    symbol_clean = asset_data.symbol.strip().upper()

    existing = await db.assets.find_one({"symbol": symbol_clean})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Asset with symbol '{symbol_clean}' already exists."
        )

    doc = asset_data.model_dump(exclude_none=True)
    doc["symbol"] = symbol_clean
    doc["type"] = doc["type"].lower()
    doc["created_at"] = datetime.now(timezone.utc)

    result = await db.assets.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    return doc

@router.get("", response_model=List[AssetResponse], summary="List / Search Assets")
async def list_assets(
    type: Optional[str] = Query(None, description="Filter by 'crypto' or 'stock'"),
    search: Optional[str] = Query(None, description="Search by symbol or name"),
    current_user: dict = Depends(get_current_user)
):
    """
    List catalog assets with optional filtering.
    """
    db = get_database()
    query = {}
    if type:
        query["type"] = type.lower()
    if search:
        query["$or"] = [
            {"symbol": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}}
        ]

    cursor = db.assets.find(query).limit(50)
    assets = await cursor.to_list(length=50)
    for a in assets:
        a["_id"] = str(a["_id"])
    return assets

@router.get("/{symbol}", response_model=AssetResponse, summary="Get Asset by Symbol")
async def get_asset(
    symbol: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get asset details by symbol.
    """
    db = get_database()
    symbol_clean = symbol.strip().upper()
    asset = await db.assets.find_one({"symbol": symbol_clean})
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Asset '{symbol}' not found")
    asset["_id"] = str(asset["_id"])
    return asset

@router.get("/{symbol}/quote", response_model=PriceQuoteResponse, summary="Get Live Price Quote")
async def get_price_quote(
    symbol: str,
    asset_type: str = Query(..., description="'crypto' or 'stock'"),
    current_user: dict = Depends(get_current_user)
):
    """
    Fetch live price quote for an asset (using CoinGecko for crypto or Finnhub for stock)
    cached in MongoDB PriceCache for 5 minutes.
    """
    try:
        quote = await PriceService.get_live_price(symbol, asset_type)
        return quote
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch price quote for '{symbol}': {str(e)}"
        )
