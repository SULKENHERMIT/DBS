import os
from pathlib import Path
from dotenv import load_dotenv

# Explicitly load environment variables from item1.env
ENV_PATH = Path(__file__).resolve().parent.parent / "item1.env"
load_dotenv(dotenv_path=ENV_PATH if ENV_PATH.exists() else "item1.env")

class Settings:
    # MongoDB
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    DB_NAME: str = os.getenv("DB_NAME", "portfolio_management")

    # APIs
    FINNHUB_API_KEY: str = os.getenv("FINNHUB_API_KEY", "")
    COINGECKO_API_KEY: str = os.getenv("COINGECKO_API_KEY", "")

    # Authentication & JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "fallback_secret_key_change_me_in_production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours

    # Cache
    PRICE_CACHE_EXPIRY_SECONDS: int = int(os.getenv("PRICE_CACHE_EXPIRY_SECONDS", "300")) # 5 minutes

settings = Settings()

if not settings.MONGODB_URI:
    raise ValueError("MONGODB_URI not found in item1.env. Please verify item1.env configuration.")

if not settings.JWT_SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY not found in item1.env.")
