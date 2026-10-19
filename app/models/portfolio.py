from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel, PyObjectId

# --- HOLDINGS (Embedded in Portfolios as per ER diagram) ---

class HoldingBase(BaseModel):
    symbol: str = Field(..., description="Asset ticker symbol, e.g. BTC, ETH, AAPL, TSLA")
    name: Optional[str] = Field(default=None, description="Asset display name")
    type: str = Field(..., description="Asset type: 'crypto' or 'stock'")
    quantity: float = Field(..., gt=0, description="Amount of asset held")
    average_buy_price: float = Field(..., ge=0, description="Average purchase price in USD")
    asset_id: Optional[str] = Field(default=None, description="Optional reference to an asset in the catalog")

class HoldingCreate(HoldingBase):
    pass

class HoldingUpdate(BaseModel):
    quantity: Optional[float] = Field(default=None, gt=0)
    average_buy_price: Optional[float] = Field(default=None, ge=0)
    name: Optional[str] = None

class HoldingInDB(MongoBaseModel, HoldingBase):
    id: str = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HoldingResponse(MongoBaseModel):
    id: str = Field(alias="_id")
    symbol: str
    name: Optional[str] = None
    type: str
    quantity: float
    average_buy_price: float
    asset_id: Optional[str] = None
    updated_at: datetime

class HoldingValuationResponse(BaseModel):
    id: str
    symbol: str
    name: Optional[str] = None
    type: str
    quantity: float
    average_buy_price: float
    total_invested: float
    current_price: float
    current_value: float
    gain_loss: float
    gain_loss_pct: float
    price_source: str
    cached: bool
    price_updated_at: datetime

# --- PORTFOLIOS ---

class PortfolioBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Name of portfolio")

class PortfolioCreate(PortfolioBase):
    pass

class PortfolioUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)

class PortfolioInDB(MongoBaseModel, PortfolioBase):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: str = Field(..., description="Owner user ID")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    holdings: List[HoldingInDB] = Field(default_factory=list)

class PortfolioResponse(MongoBaseModel):
    id: str = Field(alias="_id")
    user_id: str
    name: str
    created_at: datetime
    holdings: List[HoldingResponse] = Field(default_factory=list)

class PortfolioValuationSummary(BaseModel):
    portfolio_id: str
    portfolio_name: str
    total_invested: float
    total_current_value: float
    total_gain_loss: float
    total_gain_loss_pct: float
    holdings_valuation: List[HoldingValuationResponse]
