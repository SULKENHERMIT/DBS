from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_database
from app.models.user import TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.audit_service import log_user_action

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="User Signup")
async def signup(user_data: UserCreate):
    """
    Register a new user with email, password (hashed with bcrypt), and base currency.
    """
    db = get_database()
    email_clean = user_data.email.strip().lower()
    
    # Check if user already exists
    existing = await db.users.find_one({"email": email_clean})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )

    # Hash password with bcrypt
    hashed_pwd = hash_password(user_data.password)

    user_doc = {
        "email": email_clean,
        "password_hash": hashed_pwd,
        "base_currency": user_data.base_currency.upper(),
        "created_at": datetime.now(timezone.utc)
    }

    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Log action
    await log_user_action(user_id, "USER_SIGNUP")

    return {
        "_id": user_id,
        "email": email_clean,
        "base_currency": user_doc["base_currency"],
        "created_at": user_doc["created_at"]
    }

@router.post("/login", response_model=TokenResponse, summary="User Login")
async def login(credentials: UserLogin):
    """
    Authenticate user with email and password, issuing a JWT bearer token.
    """
    db = get_database()
    email_clean = credentials.email.strip().lower()

    user = await db.users.find_one({"email": email_clean})
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = str(user["_id"])
    access_token = create_access_token(data={"sub": user_id, "email": user["email"]})

    # Log action
    await log_user_action(user_id, "USER_LOGIN")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "_id": user_id,
            "email": user["email"],
            "base_currency": user.get("base_currency", "USD"),
            "created_at": user.get("created_at", datetime.now(timezone.utc))
        }
    }

@router.get("/me", response_model=UserResponse, summary="Current User Profile")
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get authenticated user information.
    """
    return {
        "_id": str(current_user["_id"]),
        "email": current_user["email"],
        "base_currency": current_user.get("base_currency", "USD"),
        "created_at": current_user.get("created_at", datetime.now(timezone.utc))
    }
