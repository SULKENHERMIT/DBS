import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, db_instance
from app.routers import (
    auth_router,
    portfolios_router,
    holdings_router,
    assets_router,
    transactions_router,
    watchlists_router,
    alerts_router,
    market_router,
    performance_router
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("app.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing Portfolio Management Backend...")
    await connect_to_mongo()
    logger.info("Connected to MongoDB using item1.env credentials.")
    yield
    # Shutdown
    logger.info("Shutting down Portfolio Management Backend...")
    await close_mongo_connection()

app = FastAPI(
    title="Live Stock & Crypto Portfolio Management API",
    description="""
    ## Live Stock & Cryptocurrency Portfolio Management Backend
    
    Translates ER diagram into MongoDB collections with:
    - **JWT Authentication** (signup, login, bcrypt hashed passwords)
    - **Portfolios & Embedded Holdings** (User-scoped CRUD)
    - **Live Price Service**:
      - **CoinGecko Public API** for cryptocurrencies
      - **Finnhub API** for US equities / stocks
      - **MongoDB 5-Minute Cache** (`price_cache` collection with TTL indexing)
    - **Real-Time Valuation & Gain/Loss** calculation for holdings & portfolios
    - **Transactions, Watchlists, Alerts, Exchanges, Price History, and Audit Logging**
    """,
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(portfolios_router)
app.include_router(holdings_router)
app.include_router(assets_router)
app.include_router(transactions_router)
app.include_router(watchlists_router)
app.include_router(alerts_router)
app.include_router(performance_router)
app.include_router(market_router)

from pathlib import Path
from fastapi.staticfiles import StaticFiles

@app.get("/health", tags=["Health"], summary="Health Check")
async def health_check():
    db_status = "connected" if db_instance.client is not None else "disconnected"
    return {
        "status": "healthy",
        "database": db_status,
        "environment_file": "item1.env"
    }

# Mount Frontend UI static directory
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
