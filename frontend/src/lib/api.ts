import {
  HealthStatus,
  SystemStatus,
  MarketSummary,
  WatchlistItem,
  AssetDetail,
  PricePoint,
  CandlePoint,
  AssetStats,
  PortfolioSummary,
  PortfolioValuation,
  PortfolioPerformancePoint,
  AlertItem,
  NotificationItem,
  HypertableStats,
  ChunkItem,
  DailySummaryItem,
  WorkbenchSchemaResponse,
  QueryExecuteResponse,
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${res.statusText || errorBody}`);
  }
  return res.json();
}

export const api = {
  getHealth: () => fetchJson<HealthStatus>('/health'),
  getSystemStatus: () => fetchJson<SystemStatus>('/system/status'),
  getMarketSummary: () => fetchJson<MarketSummary>('/market/summary'),
  getWatchlist: (type?: string) =>
    fetchJson<WatchlistItem[]>(`/market/watchlist${type ? `?asset_type=${type}` : ''}`),
  getAssets: (type?: string) =>
    fetchJson<AssetDetail[]>(`/assets${type ? `?asset_type=${type}` : ''}`),
  getAsset: (symbol: string) => fetchJson<AssetDetail>(`/assets/${symbol}`),
  getAssetHistory: (symbol: string, range = '7d', limit = 1000) =>
    fetchJson<PricePoint[]>(`/assets/${symbol}/history?range=${range}&limit=${limit}`),
  getAssetCandles: (symbol: string, range = '7d', limit = 300) =>
    fetchJson<CandlePoint[]>(`/assets/${symbol}/candles?range=${range}&limit=${limit}`),
  getAssetStats: (symbol: string, range = '7d') =>
    fetchJson<AssetStats>(`/assets/${symbol}/stats?range=${range}`),
  getPortfolios: () => fetchJson<PortfolioSummary[]>('/portfolios'),
  getPortfolioValuation: (portfolioId: string) =>
    fetchJson<PortfolioValuation>(`/portfolios/${portfolioId}/valuation`),
  getPortfolioPerformance: (portfolioId: string) =>
    fetchJson<PortfolioPerformancePoint[]>(`/portfolios/${portfolioId}/performance`),
  getAlerts: (status?: string, symbol?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (symbol) params.append('symbol', symbol);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return fetchJson<AlertItem[]>(`/alerts${qs}`);
  },
  getNotifications: () => fetchJson<NotificationItem[]>('/notifications'),
  getHypertableStats: () => fetchJson<HypertableStats>('/timeseries/hypertable-stats'),
  getChunks: () => fetchJson<ChunkItem[]>('/timeseries/chunks'),
  getDailySummary: (limit = 30) =>
    fetchJson<DailySummaryItem[]>(`/timeseries/daily-summary?limit=${limit}`),

  // --- SQL Query Workbench ---
  getWorkbenchSchema: () => fetchJson<WorkbenchSchemaResponse>('/query-workbench/schema'),
  executeWorkbenchQuery: (query: string, params?: any[], limit = 100) =>
    fetchJson<QueryExecuteResponse>('/query-workbench/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, params: params || [], limit }),
    }),
};
