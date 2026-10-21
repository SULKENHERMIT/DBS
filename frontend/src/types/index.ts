export interface HealthStatus {
  status: string;
  database: string;
  database_engine: string;
  version: string;
  server_time: string;
}

export interface SystemStatus {
  database_connected: boolean;
  database_engine: string;
  database_version: string;
  host: string;
  port: number;
  database_name: string;
  authenticated_user: string;
  total_hypertable_chunks: number;
  compressed_chunks: number;
  total_price_ticks: number;
  earliest_observation: string | null;
  latest_observation: string | null;
  tracked_assets_count: number;
  data_source_mode: string;
}

export interface WatchlistItem {
  asset_id: string;
  symbol: string;
  name: string;
  type: string;
  price: number;
  volume_24h: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  updated_at: string;
  sparkline: number[];
}

export interface MarketSummary {
  tracked_assets_count: number;
  total_volume_24h: number;
  top_gainer: {
    symbol: string;
    name: string;
    type: string;
    price_per_unit: number;
    change_24h: number;
  } | null;
  top_loser: {
    symbol: string;
    name: string;
    type: string;
    price_per_unit: number;
    change_24h: number;
  } | null;
  active_alerts_count: number;
  total_observations_count: number;
  latest_update: string | null;
  data_notice: string;
}

export interface AssetDetail {
  asset_id: string;
  symbol: string;
  name: string;
  type: string;
  network?: string | null;
  sector?: string | null;
  ticker_exchange?: string | null;
  current_price?: number | null;
  volume_24h?: number | null;
  change_24h?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  updated_at?: string | null;
}

export interface PricePoint {
  timestamp: string;
  price: number;
  volume?: number | null;
}

export interface CandlePoint {
  candle_bucket: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  total_volume: number;
  tick_count: number;
}

export interface AssetStats {
  symbol: string;
  time_range: string;
  start_price: number;
  latest_price: number;
  price_change: number;
  price_change_pct: number;
  high_price: number;
  low_price: number;
  total_volume: number;
  observation_count: number;
}

export interface PortfolioSummary {
  portfolio_id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface HoldingItem {
  holding_id: string;
  symbol: string;
  name: string;
  type: string;
  quantity: number;
  average_buy_price: number;
  current_price: number;
  cost_basis: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  allocation_pct: number;
}

export interface PortfolioValuation {
  portfolio_id: string;
  portfolio_name: string;
  total_market_value: number;
  total_cost_basis: number;
  total_unrealized_pnl: number;
  total_unrealized_pnl_pct: number;
  holdings: HoldingItem[];
}

export interface PortfolioPerformancePoint {
  performance_id: string;
  timestamp: string;
  total_value: number;
  total_profit_loss: number;
  total_profit_loss_pct: number;
}

export interface AlertItem {
  alert_id: string;
  user_id: string;
  symbol: string;
  asset_name?: string | null;
  threshold: number;
  direction: string;
  enabled: boolean;
  triggered_at?: string | null;
  created_at: string;
  status_label: string;
}

export interface NotificationItem {
  notification_id: string;
  alert_id: string;
  symbol: string;
  threshold: number;
  direction: string;
  channel: string;
  status: string;
  sent_at: string;
}

export interface HypertableStats {
  hypertable_name: string;
  total_chunks: number;
  compressed_chunks: number;
  uncompressed_chunks: number;
  uncompressed_bytes: number;
  compressed_bytes: number;
  space_saved_bytes: number;
  space_saved_pct: number;
  compression_ratio: number;
}

export interface ChunkItem {
  chunk_name: string;
  range_start: string;
  range_end: string;
  is_compressed: boolean;
  compression_state: string;
}

export interface DailySummaryItem {
  bucket_date: string;
  symbol: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  total_volume: number;
  tick_count: number;
}

// --- SQL Query Workbench Types ---
export interface WorkbenchColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface WorkbenchTable {
  name: string;
  type: 'hypertable' | 'continuous_aggregate' | 'relational_table' | 'system_view';
  description: string;
  timestamp_column: string | null;
  default_sort: string | null;
  columns: WorkbenchColumn[];
}

export interface WorkbenchTimeBucket {
  label: string;
  value: string;
}

export interface WorkbenchExampleQuery {
  id: string;
  name: string;
  description: string;
  category: string;
  sql: string;
}

export interface WorkbenchSchemaResponse {
  status: string;
  engine: string;
  role: string;
  server_max_limit: number;
  default_timeout_ms: number;
  tables: WorkbenchTable[];
  time_buckets: WorkbenchTimeBucket[];
  example_queries: WorkbenchExampleQuery[];
}

export interface QueryExecuteRequest {
  query: string;
  params?: any[];
  limit?: number;
}

export interface QueryExecuteResponse {
  success: boolean;
  columns: string[];
  column_types: string[];
  rows: any[][];
  row_count: number;
  execution_ms: number;
  truncated: boolean;
  max_limit: number;
  error?: string | null;
  query_executed?: string | null;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  saved_at: string;
}

export interface QueryHistoryItem {
  id: string;
  sql: string;
  executed_at: string;
  execution_ms: number;
  row_count: number;
  success: boolean;
  error?: string | null;
}
