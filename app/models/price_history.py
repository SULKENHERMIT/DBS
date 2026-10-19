from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel, PyObjectId

class PriceHistoryRecord(BaseModel):
    asset_id: Optional[str] = None
    symbol: str
    price: float
    volume: Optional[float] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PriceHistoryInDB(MongoBaseModel, PriceHistoryRecord):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

class PriceHistoryResponse(MongoBaseModel, PriceHistoryRecord):
    id: str = Field(alias="_id")
