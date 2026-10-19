from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth import get_current_user
from app.database import get_database
from app.models.audit_log import AuditLogResponse
from app.models.currency_rate import CurrencyRateBase, CurrencyRateResponse
from app.models.exchange import ExchangeCreate, ExchangeResponse
from app.models.news import NewsArticleCreate, NewsArticleResponse
from app.services.price_service import PriceService

router = APIRouter(prefix="/market", tags=["Market & Reference Data"])

# --- SYMBOL SEARCH & FULL CATALOG ---
@router.get("/symbols/stats", summary="Get symbol catalog statistics")
async def get_symbol_stats(current_user: dict = Depends(get_current_user)):
    """Return total count of live symbols loaded from Finnhub and CoinGecko."""
    stats = await PriceService.get_symbol_stats()
    return stats

@router.get("/symbols/all", summary="Get full symbol catalog for client-side caching")
async def get_all_symbols(
    type: str = Query("stock", description="Asset type: 'crypto' or 'stock'"),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns the complete list of US stocks (30,000+) or crypto coins (18,000+)
    for client-side caching and instant local filtering.
    """
    clean_type = type.lower()
    if clean_type == "crypto":
        items = await PriceService.get_crypto_symbols()
    else:
        items = await PriceService.get_stock_symbols()
    return items

@router.get("/symbols", summary="Search live CoinGecko crypto and Finnhub stock symbols")
async def search_market_symbols(
    type: str = Query("stock", description="Asset type: 'crypto' or 'stock'"),
    query: str = Query("", description="Search ticker symbol or asset name"),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Search for valid stock symbols (Finnhub US) or crypto symbols (CoinGecko).
    Returns real matching symbols with names for frontend autocomplete.
    """
    results = await PriceService.search_symbols(asset_type=type, query=query, limit=limit)
    return results

@router.get("/history", summary="Get historical price chart data")
async def get_price_history(
    symbol: str = Query(..., description="Ticker symbol e.g. BTC, AAPL"),
    type: str = Query("stock", description="Asset type: 'crypto' or 'stock'"),
    interval: str = Query("1M", description="Chart timeframe: '1D', '1W', '1M', '3M', '1Y'"),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns historical price points for CoinGecko crypto (market_chart) or Finnhub stocks (candles/quote).
    """
    data = await PriceService.get_price_history(symbol=symbol, asset_type=type, interval=interval)
    return data




# --- EXCHANGES ---
@router.post("/exchanges", response_model=ExchangeResponse, status_code=status.HTTP_201_CREATED, summary="Create Exchange")
async def create_exchange(
    exchange_data: ExchangeCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    doc = exchange_data.model_dump()
    result = await db.exchanges.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc

@router.get("/exchanges", response_model=List[ExchangeResponse], summary="List Exchanges")
async def list_exchanges(current_user: dict = Depends(get_current_user)):
    db = get_database()
    cursor = db.exchanges.find().limit(50)
    items = await cursor.to_list(length=50)
    for it in items:
        it["_id"] = str(it["_id"])
    return items

# --- NEWS ARTICLES ---
@router.post("/news", response_model=NewsArticleResponse, status_code=status.HTTP_201_CREATED, summary="Add News Article")
async def create_news(
    news_data: NewsArticleCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    doc = news_data.model_dump()
    doc["published_at"] = datetime.now(timezone.utc)
    result = await db.news_articles.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc

@router.get("/news", response_model=List[NewsArticleResponse], summary="List News Articles")
async def list_news(
    symbol: Optional[str] = Query(None, description="Filter by asset symbol"),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    query = {}
    if symbol:
        query["asset_ids"] = symbol.strip().upper()

    cursor = db.news_articles.find(query).sort("published_at", -1).limit(50)
    items = await cursor.to_list(length=50)
    for it in items:
        it["_id"] = str(it["_id"])
    return items

# --- CURRENCY RATES ---
@router.post("/currency-rates", response_model=CurrencyRateResponse, summary="Set Currency Rate")
async def set_currency_rate(
    rate_data: CurrencyRateBase,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    doc = {
        "_id": rate_data.currency_code.upper(),
        "currency_code": rate_data.currency_code.upper(),
        "rate_to_usd": float(rate_data.rate_to_usd),
        "updated_at": datetime.now(timezone.utc)
    }
    await db.currency_rates.update_one(
        {"_id": doc["_id"]},
        {"$set": doc},
        upsert=True
    )
    return doc

@router.get("/currency-rates", response_model=List[CurrencyRateResponse], summary="List Currency Rates")
async def list_currency_rates(current_user: dict = Depends(get_current_user)):
    db = get_database()
    cursor = db.currency_rates.find()
    items = await cursor.to_list(length=100)
    return items

# --- AUDIT LOGS ---
@router.get("/audit-logs", response_model=List[AuditLogResponse], summary="List User Audit Logs")
async def list_user_audit_logs(current_user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = str(current_user["_id"])
    cursor = db.audit_logs.find({"user_id": user_id}).sort("timestamp", -1).limit(100)
    logs = await cursor.to_list(length=100)
    for l in logs:
        l["_id"] = str(l["_id"])
    return logs
