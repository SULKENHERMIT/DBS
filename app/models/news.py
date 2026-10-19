from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel, PyObjectId

class NewsArticleBase(BaseModel):
    headline: str
    source: str
    url: str
    published_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    asset_ids: List[str] = Field(default_factory=list, description="Referenced asset symbols or ids")

class NewsArticleCreate(NewsArticleBase):
    pass

class NewsArticleInDB(MongoBaseModel, NewsArticleBase):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

class NewsArticleResponse(MongoBaseModel, NewsArticleBase):
    id: str = Field(alias="_id")
