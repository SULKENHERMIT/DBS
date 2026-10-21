from fastapi import APIRouter, HTTPException, Path
from typing import List
from uuid import UUID
from app.db import fetch_all, fetch_one
from app.models import PortfolioSummary, PortfolioValuationResponse, HoldingItem, PortfolioPerformancePoint

router = APIRouter(prefix="/portfolios", tags=["Portfolio Analytics"])

@router.get("", response_model=List[PortfolioSummary])
async def list_portfolios():
    try:
        rows = await fetch_all("""
            SELECT portfolio_id, user_id, name, created_at
            FROM portfolios
            ORDER BY created_at ASC;
        """)
        return [PortfolioSummary(**row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list portfolios: {str(e)}")

@router.get("/{portfolio_id}/valuation", response_model=PortfolioValuationResponse)
async def get_portfolio_valuation(portfolio_id: UUID = Path(..., description="Target portfolio UUID")):
    try:
        # Get portfolio name
        p_row = await fetch_one("SELECT name FROM portfolios WHERE portfolio_id = $1;", portfolio_id)
        if not p_row:
            raise HTTPException(status_code=404, detail=f"Portfolio '{portfolio_id}' not found")
        portfolio_name = p_row["name"]

        # Call database stored function
        raw_holdings = await fetch_all("""
            SELECT 
                holding_id,
                symbol,
                name,
                type,
                quantity::float AS quantity,
                average_buy_price::float AS average_buy_price,
                current_price::float AS current_price,
                cost_basis::float AS cost_basis,
                market_value::float AS market_value,
                unrealized_pnl::float AS unrealized_pnl,
                unrealized_pnl_pct::float AS unrealized_pnl_pct
            FROM get_portfolio_valuation($1::uuid)
            ORDER BY market_value DESC;
        """, portfolio_id)

        total_market_value = sum(h["market_value"] for h in raw_holdings)
        total_cost_basis = sum(h["cost_basis"] for h in raw_holdings)
        total_unrealized_pnl = sum(h["unrealized_pnl"] for h in raw_holdings)
        total_unrealized_pnl_pct = (total_unrealized_pnl / total_cost_basis * 100.0) if total_cost_basis > 0 else 0.0

        holdings: List[HoldingItem] = []
        for h in raw_holdings:
            alloc_pct = (h["market_value"] / total_market_value * 100.0) if total_market_value > 0 else 0.0
            holdings.append(HoldingItem(
                holding_id=h["holding_id"],
                symbol=h["symbol"],
                name=h["name"],
                type=h["type"],
                quantity=round(h["quantity"], 4),
                average_buy_price=round(h["average_buy_price"], 2),
                current_price=round(h["current_price"], 2),
                cost_basis=round(h["cost_basis"], 2),
                market_value=round(h["market_value"], 2),
                unrealized_pnl=round(h["unrealized_pnl"], 2),
                unrealized_pnl_pct=round(h["unrealized_pnl_pct"], 2),
                allocation_pct=round(alloc_pct, 2)
            ))

        return PortfolioValuationResponse(
            portfolio_id=portfolio_id,
            portfolio_name=portfolio_name,
            total_market_value=round(total_market_value, 2),
            total_cost_basis=round(total_cost_basis, 2),
            total_unrealized_pnl=round(total_unrealized_pnl, 2),
            total_unrealized_pnl_pct=round(total_unrealized_pnl_pct, 2),
            holdings=holdings
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate portfolio valuation: {str(e)}")

@router.get("/{portfolio_id}/performance", response_model=List[PortfolioPerformancePoint])
async def get_portfolio_performance(portfolio_id: UUID = Path(...)):
    try:
        rows = await fetch_all("""
            SELECT 
                performance_id,
                timestamp,
                total_value::float AS total_value,
                total_profit_loss::float AS total_profit_loss,
                total_profit_loss_pct::float AS total_profit_loss_pct
            FROM portfolio_performance
            WHERE portfolio_id = $1
            ORDER BY timestamp ASC;
        """, portfolio_id)

        return [PortfolioPerformancePoint(**r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch portfolio performance history: {str(e)}")
