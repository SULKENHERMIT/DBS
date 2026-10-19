from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel, PyObjectId

class PriceCacheRecord(MongoBaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    symbol: str
    asset_type: str = Field(..., description="'crypto' or 'stock'")
    price_usd: float
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    volume_24h: Optional[float] = None
    change_24h: Optional[float] = None
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expire_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)
