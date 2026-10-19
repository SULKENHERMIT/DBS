from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel, PyObjectId

class PortfolioPerformanceSnapshot(BaseModel):
    portfolio_id: str
    total_value: float = Field(..., description="Total current value in base currency")
    total_profit_loss: float = Field(..., description="Total absolute profit / loss")
    total_profit_loss_pct: float = Field(..., description="Total profit / loss percentage")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PortfolioPerformanceInDB(MongoBaseModel, PortfolioPerformanceSnapshot):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

class PortfolioPerformanceResponse(MongoBaseModel, PortfolioPerformanceSnapshot):
    id: str = Field(alias="_id")
