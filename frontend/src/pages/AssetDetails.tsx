import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Layers,
  ArrowLeft,
  ChevronDown,
  BarChart3,
  CandlestickChart as CandleIcon,
} from 'lucide-react';
import { AssetDetail, PricePoint, CandlePoint, AssetStats } from '../types';
import { api } from '../lib/api';
import { formatCurrency, formatPercent, formatNumber, formatDateTime, formatDate } from '../lib/formatters';
import { CandlestickChart } from '../components/common/CandlestickChart';

interface AssetDetailsProps {
  symbol: string;
  onSelectSymbol: (symbol: string) => void;
  onBackToOverview: () => void;
}

export const AssetDetails: React.FC<AssetDetailsProps> = ({
  symbol,
  onSelectSymbol,
  onBackToOverview,
}) => {
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d' | 'all'>('7d');
  const [chartMode, setChartMode] = useState<'candles' | 'line'>('candles');

  const [history, setHistory] = useState<PricePoint[]>([]);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const availableSymbols = ['BTC', 'ETH', 'SOL', 'AAPL', 'NVDA', 'TSLA'];

  useEffect(() => {
    let isMounted = true;
    async function loadAssetData() {
      setLoading(true);
      setError(null);
      try {
        const [assetRes, statsRes, histRes, candleRes] = await Promise.all([
          api.getAsset(symbol),
          api.getAssetStats(symbol, timeRange).catch(() => null),
          api.getAssetHistory(symbol, timeRange, 1000),
          api.getAssetCandles(symbol, timeRange === '1h' ? '24h' : timeRange, 300),
        ]);
        if (isMounted) {
          setAsset(assetRes);
          setStats(statsRes);
          setHistory(histRes);
          setCandles(candleRes);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load asset details');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAssetData();
    return () => {
      isMounted = false;
    };
  }, [symbol, timeRange]);

  const isPositive = stats ? stats.price_change >= 0 : (asset?.change_24h || 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-navy-900 border border-navy-800 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToOverview}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-850 border border-navy-700 text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">{symbol}</h2>
              <span className="text-sm text-slate-400 font-medium">
                {asset?.name || symbol}
              </span>
              <span
                className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${
                  asset?.type.toLowerCase() === 'crypto'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                }`}
              >
                {asset?.type || 'ASSET'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              TimescaleDB Hypertable partitioned observation streams
            </p>
          </div>
        </div>

        {/* Quick Symbol Switcher Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Switch:</span>
          <div className="flex items-center bg-navy-950 border border-navy-700 rounded-lg p-0.5">
            {availableSymbols.map((s) => (
              <button
                key={s}
                onClick={() => onSelectSymbol(s)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  s === symbol
                    ? 'bg-brand-teal text-navy-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Price & Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Latest Price */}
        <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
          <div className="text-xs text-slate-400 mb-1">Latest Stored Price</div>
          <div className="text-2xl font-bold text-slate-100 font-tabular">
            {formatCurrency(stats?.latest_price || asset?.current_price || 0)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-medium font-tabular">
            <span
              className={`inline-flex items-center gap-0.5 ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositive ? '+' : ''}
              {stats ? formatPercent(stats.price_change_pct) : formatPercent(asset?.change_24h || 0)}
            </span>
            <span className="text-slate-500">({timeRange.toUpperCase()})</span>
          </div>
        </div>

        {/* Range High */}
        <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
          <div className="text-xs text-slate-400 mb-1">Period High</div>
          <div className="text-2xl font-bold text-emerald-400 font-tabular">
            {formatCurrency(stats?.high_price || asset?.high_24h || 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Peak tick in selected range</div>
        </div>

        {/* Range Low */}
        <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
          <div className="text-xs text-slate-400 mb-1">Period Low</div>
          <div className="text-2xl font-bold text-rose-400 font-tabular">
            {formatCurrency(stats?.low_price || asset?.low_24h || 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Trough tick in selected range</div>
        </div>

        {/* Total Volume */}
        <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
          <div className="text-xs text-slate-400 mb-1">Aggregated Volume</div>
          <div className="text-2xl font-bold text-slate-100 font-tabular">
            {formatCurrency(stats?.total_volume || asset?.volume_24h || 0, 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {stats?.observation_count || 0} Hypertable Ticks
          </div>
        </div>
      </div>

      {/* Main Interactive Chart Section */}
      <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 space-y-4">
        {/* Controls Bar: Time Range and Chart Type Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-navy-800">
          {/* Chart View Toggle */}
          <div className="flex items-center gap-1 bg-navy-950 border border-navy-700 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setChartMode('candles')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                chartMode === 'candles'
                  ? 'bg-navy-800 text-brand-teal shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CandleIcon className="h-3.5 w-3.5" />
              <span>Hourly OHLC Candles</span>
            </button>
            <button
              onClick={() => setChartMode('line')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                chartMode === 'line'
                  ? 'bg-navy-800 text-brand-teal shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Tick Price Line</span>
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-navy-950 border border-navy-700 rounded-lg p-0.5 text-xs">
            {(['1h', '24h', '7d', '30d', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 rounded-md font-medium uppercase transition ${
                  timeRange === r
                    ? 'bg-navy-800 text-brand-teal shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Render */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
            <p className="text-xs">Querying TimescaleDB hypertable chunks...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-96 text-rose-400 gap-2">
            <p className="text-sm font-semibold">Error Loading Market Data</p>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : chartMode === 'candles' ? (
          <CandlestickChart data={candles} symbol={symbol} height={380} />
        ) : (
          <div className="space-y-4">
            {/* Recharts Price Area Line */}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(val) => formatDate(val)}
                    stroke="#475569"
                    fontSize={11}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tickFormatter={(val) => `$${val > 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(2)}`}
                    stroke="#475569"
                    fontSize={11}
                    orientation="right"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload as PricePoint;
                        return (
                          <div className="bg-navy-950 border border-navy-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1 font-tabular">
                            <div className="text-slate-400">{formatDateTime(d.timestamp)}</div>
                            <div className="text-slate-100 font-bold text-sm">
                              Price: {formatCurrency(d.price)}
                            </div>
                            {d.volume !== null && d.volume !== undefined && (
                              <div className="text-slate-400">
                                Volume: {formatCurrency(d.volume, 0)}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={isPositive ? '#10b981' : '#f43f5e'}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPrice)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Volume Histogram */}
            <div className="h-24 w-full pt-2 border-t border-navy-800">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                Tick Volume Breakdown
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={history} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <XAxis dataKey="timestamp" hide />
                  <YAxis hide orientation="right" />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val) || 0, 0), 'Volume']}
                    labelFormatter={(val) => formatDateTime(String(val))}
                    contentStyle={{ backgroundColor: '#060a12', borderColor: '#223254', fontSize: '11px' }}
                  />
                  <Bar dataKey="volume" fill="#06b6d4" opacity={0.6} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Asset Metadata & TimescaleDB Hypertable Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Specification */}
        <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 space-y-3">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Asset Specifications
          </h4>
          <div className="divide-y divide-navy-800 text-xs">
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Symbol / Name</span>
              <span className="font-semibold text-slate-200">{symbol} - {asset?.name}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Asset Class</span>
              <span className="font-semibold text-slate-200 uppercase">{asset?.type}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Sector / Network</span>
              <span className="text-slate-300">{asset?.sector || asset?.network || 'Layer 1 Blockchain'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Primary Exchange</span>
              <span className="text-slate-300">{asset?.ticker_exchange || 'Global Aggregate'}</span>
            </div>
          </div>
        </div>

        {/* Time-Series Performance Summary */}
        <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 space-y-3">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            TimescaleDB Query Diagnostics
          </h4>
          <div className="divide-y divide-navy-800 text-xs font-tabular">
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Window Start Price</span>
              <span className="font-semibold text-slate-200">{formatCurrency(stats?.start_price || 0)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Window End Price</span>
              <span className="font-semibold text-slate-200">{formatCurrency(stats?.latest_price || 0)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Net Return</span>
              <span className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPercent(stats?.price_change_pct || 0)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Underlying Table</span>
              <span className="font-mono text-brand-teal text-[11px]">public.price_history (Hypertable)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
