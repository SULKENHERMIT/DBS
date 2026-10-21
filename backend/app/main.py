from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from app.config import settings
from app.db import init_db_pool, close_db_pool
from app.routes import health, market, assets, portfolios, alerts, timeseries, workbench

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("timescale_dashboard")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize TimescaleDB connection pool
    logger.info("Starting TimescaleDB Analytics API Backend...")
    try:
        await init_db_pool()
        logger.info("Database connection verified.")
    except Exception as e:
        logger.error(f"Failed to connect to TimescaleDB at startup: {e}")
    yield
    # Shutdown: Close pool
    logger.info("Shutting down TimescaleDB Analytics API Backend...")
    await close_db_pool()

app = FastAPI(
    title="Live Crypto and Stock Analysis Platform API",
    description="Dedicated backend API powered by TimescaleDB hypertables, continuous aggregates, and columnar compression.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Exception handler for unexpected errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "InternalServerError", "message": str(exc), "path": request.url.path}
    )

# Include Routers under /api
app.include_router(health.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(portfolios.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(timeseries.router, prefix="/api")
app.include_router(workbench.router, prefix="/api")

@app.get("/")
async def root():
    return {
        "service": "Live Crypto and Stock Analysis Platform API",
        "engine": "TimescaleDB",
        "docs_url": "/docs",
        "health_check": "/api/health",
        "query_workbench": "/api/query-workbench/schema"
    }
