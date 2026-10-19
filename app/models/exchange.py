from typing import Optional
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel, PyObjectId

class ExchangeBase(BaseModel):
    name: str = Field(..., description="Exchange name (e.g. NASDAQ, Binance, Coinbase)")
    country: str = Field(..., description="Country of operation")
    url: Optional[str] = Field(default=None, description="Exchange official website URL")

class ExchangeCreate(ExchangeBase):
    pass

class ExchangeInDB(MongoBaseModel, ExchangeBase):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

class ExchangeResponse(MongoBaseModel, ExchangeBase):
    id: str = Field(alias="_id")
