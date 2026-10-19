from app.routers.auth import router as auth_router
from app.routers.portfolios import router as portfolios_router
from app.routers.holdings import router as holdings_router
from app.routers.assets import router as assets_router
from app.routers.transactions import router as transactions_router
from app.routers.watchlists import router as watchlists_router
from app.routers.alerts import router as alerts_router
from app.routers.market import router as market_router
from app.routers.performance import router as performance_router

__all__ = [
    "auth_router",
    "portfolios_router",
    "holdings_router",
    "assets_router",
    "transactions_router",
    "watchlists_router",
    "alerts_router",
    "market_router",
    "performance_router"
]
