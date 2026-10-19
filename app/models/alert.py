from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel, PyObjectId

class AlertBase(BaseModel):
    symbol: str
    asset_id: Optional[str] = None
    threshold: float = Field(..., gt=0, description="Target price threshold")
    direction: str = Field(..., description="'ABOVE' or 'BELOW'")
    enabled: bool = True

class AlertCreate(AlertBase):
    pass

class AlertInDB(MongoBaseModel, AlertBase):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: str
    triggered_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AlertResponse(MongoBaseModel, AlertBase):
    id: str = Field(alias="_id")
    user_id: str
    triggered_at: Optional[datetime] = None
    created_at: datetime

class NotificationInDB(MongoBaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    alert_id: str
    user_id: str
    channel: str = Field(..., description="'EMAIL', 'SMS', 'PUSH', 'IN_APP'")
    status: str = Field(default="SENT", description="'PENDING', 'SENT', 'FAILED'")
    sent_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NotificationResponse(MongoBaseModel):
    id: str = Field(alias="_id")
    alert_id: str
    user_id: str
    channel: str
    status: str
    sent_at: datetime
