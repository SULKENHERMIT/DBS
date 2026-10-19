from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel, PyObjectId

class WatchlistItem(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    symbol: str
    asset_id: Optional[str] = None
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WatchlistBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class WatchlistCreate(WatchlistBase):
    pass

class WatchlistInDB(MongoBaseModel, WatchlistBase):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: str
    creation_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    items: List[WatchlistItem] = Field(default_factory=list)

class WatchlistResponse(MongoBaseModel):
    id: str = Field(alias="_id")
    user_id: str
    name: str
    creation_date: datetime
    items: List[WatchlistItem] = Field(default_factory=list)
