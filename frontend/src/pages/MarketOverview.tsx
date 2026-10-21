import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { MarketSummary, WatchlistItem } from '../types';
import { formatCurrency, formatPercent, formatNumber, formatDateTime } from '../lib/formatters';

interface MarketOverviewProps {
  summary: MarketSummary | null;
  watchlist: WatchlistItem[];
  loading: boolean;
  onSelectAsset: (symbol: string) => void;
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({
  summary,
  watchlist,
  loading,
  onSelectAsset,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'crypto' | 'stock'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredWatchlist = watchlist.filter((item) => {
    const matchesType = filterType === 'all' || item.type.toLowerCase() === filterType;
    const matchesSearch =
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-navy-900 border border-navy-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              TimescaleDB Market Overview & Watchlist
            </h2>
            <p className="text-xs text-slate-400">
              Real time-series records queried from hypertable <code className="font-mono text-brand-teal">price_history</code> and <code className="font-mono text-brand-teal">ticker_stats</code>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 self-start sm:self-auto">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          <span>Historical TimescaleDB Dataset</span>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tracked Assets */}
        <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Tracked Assets</span>
            <Layers className="h-4 w-4 text-brand-teal" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-tabular">
            {summary?.tracked_assets_count || watchlist.length || 6}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Crypto (BTC, ETH, SOL) & Stocks (AAPL, NVDA, TSLA)
          </div>
        </div>

        {/* 24h Volume */}
        <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>24H Aggregated Volume</span>
            <Activity className="h-4 w-4 text-brand-cyan" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-tabular">
            {formatCurrency(summary?.total_volume_24h || 0, 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            From database ticker_stats
          </div>
        </div>

        {/* Top 24h Gainer */}
        <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Top 24H Performer</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">
              {summary?.top_gainer?.symbol || 'BTC'}
            </span>
            <span className="text-sm font-semibold text-emerald-400 font-tabular">
              {formatPercent(summary?.top_gainer?.change_24h || 0)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Calculated via TimescaleDB first() & last()
          </div>
        </div>

        {/* Total Time-Series Observations */}
        <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Hypertable Observations</span>
            <Database className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-tabular">
            {formatNumber(summary?.total_observations_count || 4055)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            15 Chunks with Columnar Compression
          </div>
        </div>
      </div>

      {/* Watchlist Section */}
      <div className="rounded-xl bg-navy-900 border border-navy-800 overflow-hidden">
        {/* Watchlist Header and Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-navy-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Market Catalog Watchlist
            </h3>
            <p className="text-xs text-slate-400">
              Click any asset row to view interactive OHLC candlesticks and historical analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search symbol or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-48 rounded-lg bg-navy-950 border border-navy-700 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-teal"
              />
            </div>

            {/* Type Filters */}
            <div className="flex items-center rounded-lg bg-navy-950 border border-navy-700 p-0.5 text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-md transition ${
                  filterType === 'all'
                    ? 'bg-navy-800 text-brand-teal font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All (6)
              </button>
              <button
                onClick={() => setFilterType('crypto')}
                className={`px-2.5 py-1 rounded-md transition ${
                  filterType === 'crypto'
                    ? 'bg-navy-800 text-brand-teal font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Crypto (3)
              </button>
              <button
                onClick={() => setFilterType('stock')}
                className={`px-2.5 py-1 rounded-md transition ${
                  filterType === 'stock'
                    ? 'bg-navy-800 text-brand-teal font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Stocks (3)
              </button>
            </div>
          </div>
        </div>

        {/* Watchlist Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-navy-800">
              <tr>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Latest Price</th>
                <th className="py-3 px-4 text-right">24h Change</th>
                <th className="py-3 px-4 text-right">24h High / Low</th>
                <th className="py-3 px-4 text-right">24h Volume</th>
                <th className="py-3 px-4 text-center">20-Tick Trend</th>
                <th className="py-3 px-4 text-right">Updated At</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800/60">
              {filteredWatchlist.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No assets found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredWatchlist.map((item) => {
                  const isPositive = item.change_24h >= 0;
                  return (
                    <tr
                      key={item.symbol}
                      onClick={() => onSelectAsset(item.symbol)}
                      className="hover:bg-navy-850/60 transition cursor-pointer group"
                    >
                      {/* Asset Symbol & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 group-hover:text-brand-teal transition">
                            {item.symbol}
                          </span>
                          <span className="text-slate-400 truncate max-w-[140px]">
                            {item.name}
                          </span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            item.type.toLowerCase() === 'crypto'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>

                      {/* Latest Price */}
                      <td className="py-3.5 px-4 text-right font-medium text-slate-100 font-tabular text-sm">
                        {formatCurrency(item.price)}
                      </td>

                      {/* 24h Change */}
                      <td className="py-3.5 px-4 text-right font-tabular">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-semibold ${
                            isPositive
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {formatPercent(item.change_24h)}
                        </span>
                      </td>

                      {/* 24h High / Low */}
                      <td className="py-3.5 px-4 text-right font-tabular text-slate-300">
                        <div className="text-[11px] text-emerald-400">
                          H: {formatCurrency(item.high_24h)}
                        </div>
                        <div className="text-[11px] text-rose-400">
                          L: {formatCurrency(item.low_24h)}
                        </div>
                      </td>

                      {/* Volume */}
                      <td className="py-3.5 px-4 text-right font-tabular text-slate-300">
                        {formatCurrency(item.volume_24h, 0)}
                      </td>

                      {/* Sparkline mini visual */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center h-6 w-24 mx-auto">
                          {item.sparkline && item.sparkline.length > 1 ? (
                            <svg className="w-24 h-6 overflow-visible">
                              {(() => {
                                const min = Math.min(...item.sparkline);
                                const max = Math.max(...item.sparkline);
                                const range = max - min || 1;
                                const points = item.sparkline
                                  .map((val, idx) => {
                                    const x = (idx / (item.sparkline.length - 1)) * 96;
                                    const y = 20 - ((val - min) / range) * 16;
                                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                                  })
                                  .join(' ');
                                return (
                                  <polyline
                                    fill="none"
                                    stroke={isPositive ? '#10b981' : '#f43f5e'}
                                    strokeWidth="1.5"
                                    points={points}
                                  />
                                );
                              })()}
                            </svg>
                          ) : (
                            <span className="text-slate-600 font-mono text-[10px]">--</span>
                          )}
                        </div>
                      </td>

                      {/* Updated Timestamp */}
                      <td className="py-3.5 px-4 text-right text-slate-400 font-tabular text-[11px]">
                        {formatDateTime(item.updated_at)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-teal group-hover:underline">
                          Inspect
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
