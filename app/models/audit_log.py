from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from app.models.common import MongoBaseModel, PyObjectId

class AuditLogCreate(BaseModel):
    user_id: str
    action: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuditLogInDB(MongoBaseModel, AuditLogCreate):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

class AuditLogResponse(MongoBaseModel, AuditLogCreate):
    id: str = Field(alias="_id")
