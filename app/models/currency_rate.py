from datetime import datetime, timezone
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel

class CurrencyRateBase(BaseModel):
    currency_code: str = Field(..., description="ISO 4217 Currency Code (e.g. EUR, GBP, JPY, CAD)")
    rate_to_usd: float = Field(..., gt=0, description="Exchange rate relative to USD")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CurrencyRateInDB(MongoBaseModel, CurrencyRateBase):
    id: str = Field(alias="_id", description="currency_code serves as _id")

class CurrencyRateResponse(MongoBaseModel, CurrencyRateBase):
    pass
