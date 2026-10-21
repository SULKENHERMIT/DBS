from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class HealthResponse(BaseModel):
    status: str
    database: str
    database_engine: str
    version: str
    server_time: datetime

class SystemStatusResponse(BaseModel):
    database_connected: bool
    database_engine: str
    database_version: str
    host: str
    port: int
    database_name: str
    authenticated_user: str
    total_hypertable_chunks: int
    compressed_chunks: int
    total_price_ticks: int
    earliest_observation: Optional[datetime]
    latest_observation: Optional[datetime]
    tracked_assets_count: int
    data_source_mode: str = "TimescaleDB Real Time-Series (Hypertable Chunks)"

class WatchlistItem(BaseModel):
    asset_id: UUID
    symbol: str
    name: str
    type: str
    price: float
    volume_24h: float
    change_24h: float
    high_24h: float
    low_24h: float
    updated_at: datetime
    sparkline: List[float] = Field(default_factory=list)

class MarketSummaryResponse(BaseModel):
    tracked_assets_count: int
    total_volume_24h: float
    top_gainer: Optional[Dict[str, Any]]
    top_loser: Optional[Dict[str, Any]]
    active_alerts_count: int
    total_observations_count: int
    latest_update: Optional[datetime]
    data_notice: str = "Real database records from TimescaleDB hypertable price_history"

class AssetDetail(BaseModel):
    asset_id: UUID
    symbol: str
    name: str
    type: str
    network: Optional[str] = None
    sector: Optional[str] = None
    ticker_exchange: Optional[str] = None
    current_price: Optional[float] = None
    volume_24h: Optional[float] = None
    change_24h: Optional[float] = None
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    updated_at: Optional[datetime] = None

class PriceHistoryPoint(BaseModel):
    timestamp: datetime
    price: float
    volume: Optional[float] = None

class CandlePoint(BaseModel):
    candle_bucket: datetime
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    total_volume: float
    tick_count: int

class AssetStatsResponse(BaseModel):
    symbol: str
    time_range: str
    start_price: float
    latest_price: float
    price_change: float
    price_change_pct: float
    high_price: float
    low_price: float
    total_volume: float
    observation_count: int

class PortfolioSummary(BaseModel):
    portfolio_id: UUID
    user_id: UUID
    name: str
    created_at: datetime

class HoldingItem(BaseModel):
    holding_id: UUID
    symbol: str
    name: str
    type: str
    quantity: float
    average_buy_price: float
    current_price: float
    cost_basis: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    allocation_pct: float

class PortfolioValuationResponse(BaseModel):
    portfolio_id: UUID
    portfolio_name: str
    total_market_value: float
    total_cost_basis: float
    total_unrealized_pnl: float
    total_unrealized_pnl_pct: float
    holdings: List[HoldingItem]

class PortfolioPerformancePoint(BaseModel):
    performance_id: UUID
    timestamp: datetime
    total_value: float
    total_profit_loss: float
    total_profit_loss_pct: float

class AlertItem(BaseModel):
    alert_id: UUID
    user_id: UUID
    symbol: str
    asset_name: Optional[str] = None
    threshold: float
    direction: str
    enabled: bool
    triggered_at: Optional[datetime] = None
    created_at: datetime
    status_label: str

class NotificationItem(BaseModel):
    notification_id: UUID
    alert_id: UUID
    symbol: str
    threshold: float
    direction: str
    channel: str
    status: str
    sent_at: datetime

class HypertableStatsResponse(BaseModel):
    hypertable_name: str
    total_chunks: int
    compressed_chunks: int
    uncompressed_chunks: int
    uncompressed_bytes: Optional[int] = 0
    compressed_bytes: Optional[int] = 0
    space_saved_bytes: Optional[int] = 0
    space_saved_pct: Optional[float] = 0.0
    compression_ratio: Optional[float] = 1.0

class ChunkItem(BaseModel):
    chunk_name: str
    range_start: datetime
    range_end: datetime
    is_compressed: bool
    compression_state: str

class AssetCompareItem(BaseModel):
    symbol: str
    name: str
    type: str
    data_points: List[PriceHistoryPoint]
