from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel, PyObjectId

class TransactionBase(BaseModel):
    portfolio_id: str
    symbol: str
    asset_id: Optional[str] = None
    type: str = Field(..., description="'BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT'")
    quantity: float = Field(..., gt=0)
    price_at_transaction: float = Field(..., ge=0)
    network_hash: Optional[str] = Field(default=None, description="Blockchain tx hash or broker execution id")

class TransactionCreate(TransactionBase):
    pass

class TransactionInDB(MongoBaseModel, TransactionBase):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionResponse(MongoBaseModel, TransactionBase):
    id: str = Field(alias="_id")
    user_id: str
    timestamp: datetime
