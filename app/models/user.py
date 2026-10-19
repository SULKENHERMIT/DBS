from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.common import MongoBaseModel, PyObjectId

class UserBase(BaseModel):
    email: EmailStr
    base_currency: str = Field(default="USD", description="User preferred base currency code")

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Plaintext password for registration")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserInDB(MongoBaseModel, UserBase):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(MongoBaseModel):
    id: str = Field(alias="_id")
    email: EmailStr
    base_currency: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
