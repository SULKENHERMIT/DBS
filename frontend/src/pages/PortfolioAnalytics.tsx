import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Briefcase,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  ShieldCheck,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { PortfolioSummary, PortfolioValuation, PortfolioPerformancePoint } from '../types';
import { api } from '../lib/api';
import { formatCurrency, formatPercent, formatDateTime, formatDate } from '../lib/formatters';

const ALLOCATION_COLORS = ['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

export const PortfolioAnalytics: React.FC = () => {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [valuation, setValuation] = useState<PortfolioValuation | null>(null);
  const [performance, setPerformance] = useState<PortfolioPerformancePoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPortfolios() {
      try {
        const list = await api.getPortfolios();
        setPortfolios(list);
        if (list.length > 0) {
          setSelectedId(list[0].portfolio_id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load portfolios');
      }
    }
    loadPortfolios();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let isMounted = true;
    async function loadPortfolioData() {
      setLoading(true);
      setError(null);
      try {
        const [valRes, perfRes] = await Promise.all([
          api.getPortfolioValuation(selectedId),
          api.getPortfolioPerformance(selectedId).catch(() => []),
        ]);
        if (isMounted) {
          setValuation(valRes);
          setPerformance(perfRes);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load portfolio details');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPortfolioData();
    return () => {
      isMounted = false;
    };
  }, [selectedId]);

  const isProfitable = (valuation?.total_unrealized_pnl || 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Portfolio Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-navy-900 border border-navy-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Portfolio Valuation & Holdings Analytics
            </h2>
            <p className="text-xs text-slate-400">
              Powered by stored procedure <code className="font-mono text-brand-teal">get_portfolio_valuation()</code>.
            </p>
          </div>
        </div>

        {/* Portfolio Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Active Portfolio:</label>
          <div className="relative">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="appearance-none bg-navy-950 border border-navy-700 rounded-lg px-3 py-1.5 pr-8 text-xs font-semibold text-slate-200 focus:outline-none focus:border-brand-teal cursor-pointer"
            >
              {portfolios.map((p) => (
                <option key={p.portfolio_id} value={p.portfolio_id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-80 text-slate-400 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
          <p className="text-xs">Computing real portfolio net asset values from database...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-navy-900 border border-rose-500/30 p-6 text-center text-rose-400">
          <p className="text-sm font-semibold">Error Loading Portfolio Data</p>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      ) : (
        <>
          {/* KPI Value Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Market Value */}
            <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
              <div className="text-xs text-slate-400 mb-1">Total Market Value</div>
              <div className="text-2xl font-bold text-slate-100 font-tabular">
                {formatCurrency(valuation?.total_market_value || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-500">Live positions × Current prices</div>
            </div>

            {/* Total Cost Basis */}
            <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
              <div className="text-xs text-slate-400 mb-1">Total Cost Basis</div>
              <div className="text-2xl font-bold text-slate-300 font-tabular">
                {formatCurrency(valuation?.total_cost_basis || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-500">Cumulative invested capital</div>
            </div>

            {/* Unrealized PnL */}
            <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
              <div className="text-xs text-slate-400 mb-1">Unrealized Profit / Loss</div>
              <div
                className={`text-2xl font-bold font-tabular ${
                  isProfitable ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isProfitable ? '+' : ''}
                {formatCurrency(valuation?.total_unrealized_pnl || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-500">Open position net gain</div>
            </div>

            {/* Return % */}
            <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
              <div className="text-xs text-slate-400 mb-1">Total Return (%)</div>
              <div
                className={`text-2xl font-bold font-tabular ${
                  isProfitable ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatPercent(valuation?.total_unrealized_pnl_pct || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-500">Net percentage over cost basis</div>
            </div>
          </div>

          {/* Charts Row: Allocation Donut & Historical Equity Curve */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Allocation Donut Chart */}
            <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-navy-800">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <PieIcon className="h-4 w-4 text-brand-teal" />
                    Asset Allocation Weight
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {valuation?.holdings.length || 0} Assets
                  </span>
                </div>

                <div className="h-56 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={valuation?.holdings || []}
                        dataKey="market_value"
                        nameKey="symbol"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {(valuation?.holdings || []).map((_, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [formatCurrency(Number(val) || 0), 'Market Value']}
                        contentStyle={{
                          backgroundColor: '#060a12',
                          borderColor: '#223254',
                          fontSize: '11px',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Legend List */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-navy-800 text-xs">
                {(valuation?.holdings || []).map((h, idx) => (
                  <div key={h.symbol} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length] }}
                    />
                    <span className="font-semibold text-slate-200">{h.symbol}:</span>
                    <span className="text-slate-400 font-tabular">{h.allocation_pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical NAV Performance Equity Curve */}
            <div className="lg:col-span-2 rounded-xl bg-navy-900 border border-navy-800 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-navy-800">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand-emerald" />
                    Portfolio Historical NAV Performance
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Table: portfolio_performance
                  </span>
                </div>

                <div className="h-64 w-full">
                  {performance.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-slate-500">
                      No historical performance snapshots recorded for this portfolio.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={performance}
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={(val) => formatDate(val)}
                          stroke="#475569"
                          fontSize={11}
                        />
                        <YAxis
                          domain={['auto', 'auto']}
                          tickFormatter={(val) =>
                            `$${val > 1000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(0)}`
                          }
                          stroke="#475569"
                          fontSize={11}
                          orientation="right"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload as PortfolioPerformancePoint;
                              return (
                                <div className="bg-navy-950 border border-navy-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1 font-tabular">
                                  <div className="text-slate-400">{formatDateTime(d.timestamp)}</div>
                                  <div className="text-slate-100 font-bold">
                                    NAV: {formatCurrency(d.total_value)}
                                  </div>
                                  <div className="text-emerald-400">
                                    Gain: {formatCurrency(d.total_profit_loss)} ({formatPercent(d.total_profit_loss_pct)})
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="total_value"
                          stroke="#14b8a6"
                          strokeWidth={2.5}
                          dot={{ fill: '#14b8a6', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 pt-2 border-t border-navy-800 flex justify-between">
                <span>Snapshot points: {performance.length}</span>
                <span>Valuation base currency: USD</span>
              </div>
            </div>
          </div>

          {/* Itemized Holdings Table */}
          <div className="rounded-xl bg-navy-900 border border-navy-800 overflow-hidden">
            <div className="p-4 border-b border-navy-800">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Active Position Holdings
              </h3>
              <p className="text-xs text-slate-400">
                Itemized cost basis, latest market value, and unrealized profit & loss per asset.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-navy-800">
                  <tr>
                    <th className="py-3 px-4">Asset</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-right">Avg Buy Price</th>
                    <th className="py-3 px-4 text-right">Current Price</th>
                    <th className="py-3 px-4 text-right">Cost Basis</th>
                    <th className="py-3 px-4 text-right">Market Value</th>
                    <th className="py-3 px-4 text-right">Unrealized PnL ($)</th>
                    <th className="py-3 px-4 text-right">Return (%)</th>
                    <th className="py-3 px-4 text-right">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800/60 font-tabular">
                  {(valuation?.holdings || []).map((h) => {
                    const isGain = h.unrealized_pnl >= 0;
                    return (
                      <tr key={h.holding_id} className="hover:bg-navy-850/50 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-100">
                          {h.symbol}
                          <span className="text-slate-400 font-normal ml-1.5 hidden sm:inline">
                            {h.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 uppercase text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-navy-950 border border-navy-700 text-slate-300">
                            {h.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-200">
                          {h.quantity}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400">
                          {formatCurrency(h.average_buy_price)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-200 font-medium">
                          {formatCurrency(h.current_price)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400">
                          {formatCurrency(h.cost_basis)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-100 font-bold">
                          {formatCurrency(h.market_value)}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-semibold ${
                            isGain ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isGain ? '+' : ''}
                          {formatCurrency(h.unrealized_pnl)}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-semibold ${
                            isGain ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatPercent(h.unrealized_pnl_pct)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-brand-teal font-medium">
                          {h.allocation_pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
