from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel, PyObjectId

class TickerStats(BaseModel):
    price_per_unit: Optional[float] = Field(default=None, description="Latest price per unit")
    volume_24h: Optional[float] = Field(default=None, description="24h trading volume")
    high_24h: Optional[float] = Field(default=None, description="24h high price")
    low_24h: Optional[float] = Field(default=None, description="24h low price")
    updated_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))

class AssetBase(BaseModel):
    symbol: str = Field(..., description="Ticker symbol (e.g. BTC, ETH, AAPL)")
    name: str = Field(..., description="Full asset name")
    type: str = Field(..., description="'crypto' or 'stock'")
    
    # Optional 1:1 Ticker stats
    ticker_stats: Optional[TickerStats] = None
    
    # Crypto specific (Disjoint specialization in ER)
    network: Optional[str] = Field(default=None, description="Blockchain network (e.g. Ethereum, Solana)")
    contract_address: Optional[str] = Field(default=None, description="Smart contract address")
    
    # Stock specific (Disjoint specialization in ER)
    ticker_exchange: Optional[str] = Field(default=None, description="Exchange ticker (e.g. NASDAQ, NYSE)")
    sector: Optional[str] = Field(default=None, description="Industry sector (e.g. Technology, Healthcare)")

class AssetCreate(AssetBase):
    pass

class AssetInDB(MongoBaseModel, AssetBase):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AssetResponse(MongoBaseModel, AssetBase):
    id: str = Field(alias="_id")
    created_at: Optional[datetime] = None

class PriceQuoteResponse(BaseModel):
    symbol: str
    asset_type: str
    price: float
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    volume_24h: Optional[float] = None
    change_24h: Optional[float] = None
    source: str
    cached: bool
    fetched_at: datetime
