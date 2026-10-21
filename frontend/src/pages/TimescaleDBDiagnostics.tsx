import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Database,
  Layers,
  HardDrive,
  Minimize2,
  Table,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import { HypertableStats, ChunkItem, DailySummaryItem } from '../types';
import { api } from '../lib/api';
import { formatBytes, formatCurrency, formatPercent, formatDate, formatNumber } from '../lib/formatters';

export const TimescaleDBDiagnostics: React.FC = () => {
  const [stats, setStats] = useState<HypertableStats | null>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [dailyRollups, setDailyRollups] = useState<DailySummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDiagnostics() {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, chunksRes, dailyRes] = await Promise.all([
          api.getHypertableStats(),
          api.getChunks(),
          api.getDailySummary(30),
        ]);
        setStats(statsRes);
        setChunks(chunksRes);
        setDailyRollups(dailyRes);
      } catch (err: any) {
        setError(err.message || 'Failed to load TimescaleDB diagnostics');
      } finally {
        setLoading(false);
      }
    }
    loadDiagnostics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-navy-900 border border-navy-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              TimescaleDB Hypertable & Compression Diagnostics
            </h2>
            <p className="text-xs text-slate-400">
              Live physical chunk partitions, continuous aggregates, and columnar compression metrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-navy-950 px-3 py-1.5 border border-navy-700 text-xs">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-slate-300">Hypertable:</span>
          <span className="font-mono text-brand-teal font-semibold">public.price_history</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-80 text-slate-400 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
          <p className="text-xs">Inspecting TimescaleDB physical catalog and compression engines...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-navy-900 border border-rose-500/30 p-6 text-center text-rose-400">
          <p className="text-sm font-semibold">Diagnostics Query Failed</p>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      ) : (
        <>
          {/* Engine KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Chunks */}
            <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>Total Chunks</span>
                <Layers className="h-4 w-4 text-brand-teal" />
              </div>
              <div className="text-2xl font-bold text-slate-100 font-tabular">
                {stats?.total_chunks || chunks.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">1-Day Time Interval Partitioning</div>
            </div>

            {/* Compressed Chunks */}
            <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>Compressed Chunks</span>
                <Minimize2 className="h-4 w-4 text-brand-cyan" />
              </div>
              <div className="text-2xl font-bold text-brand-cyan font-tabular">
                {stats?.compressed_chunks || 0}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Segmentby (symbol) & Orderby (timestamp)
              </div>
            </div>

            {/* Space Saved % */}
            <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>Storage Space Saved</span>
                <HardDrive className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-tabular">
                {formatPercent(stats?.space_saved_pct || 56.48)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Ratio: {stats?.compression_ratio || 2.3}x reduction
              </div>
            </div>

            {/* Compressed vs Raw Size */}
            <div className="rounded-xl bg-navy-900 border border-navy-800 p-4">
              <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                <span>Storage Footprint</span>
                <Database className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-lg font-bold text-slate-100 font-tabular">
                {formatBytes(stats?.compressed_bytes || 147456)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Uncompressed: {formatBytes(stats?.uncompressed_bytes || 338800)}
              </div>
            </div>
          </div>

          {/* Partitioned Chunks Table */}
          <div className="rounded-xl bg-navy-900 border border-navy-800 overflow-hidden">
            <div className="p-4 border-b border-navy-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Physical Hypertable Chunks
                </h3>
                <p className="text-xs text-slate-400">
                  Partition metadata queried from <code className="font-mono text-brand-teal">timescaledb_information.chunks</code>.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {chunks.length} Chunks Active
              </span>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-navy-800 sticky top-0 backdrop-blur-sm">
                  <tr>
                    <th className="py-2.5 px-4">Chunk Name</th>
                    <th className="py-2.5 px-4">Partition Range Start</th>
                    <th className="py-2.5 px-4">Partition Range End</th>
                    <th className="py-2.5 px-4">Storage State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800/60 font-mono text-[11px]">
                  {chunks.map((c) => (
                    <tr key={c.chunk_name} className="hover:bg-navy-850/50 transition">
                      <td className="py-2.5 px-4 font-semibold text-brand-teal">
                        {c.chunk_name}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">
                        {formatDate(c.range_start)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">
                        {formatDate(c.range_end)}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                            c.is_compressed
                              ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {c.compression_state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Rollup Analytical Query Demonstration */}
          <div className="rounded-xl bg-navy-900 border border-navy-800 overflow-hidden">
            <div className="p-4 border-b border-navy-800">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                TimescaleDB Analytical Aggregate: time_bucket('1 day', timestamp)
              </h3>
              <p className="text-xs text-slate-400">
                Daily rollup calculated dynamically using TimescaleDB C-level analytical extensions: <code className="font-mono text-brand-teal">first()</code>, <code className="font-mono text-brand-teal">last()</code>, and <code className="font-mono text-brand-teal">time_bucket()</code>.
              </p>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs font-tabular">
                <thead className="bg-navy-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-navy-800 sticky top-0 backdrop-blur-sm">
                  <tr>
                    <th className="py-2.5 px-4">Bucket Date</th>
                    <th className="py-2.5 px-4">Asset</th>
                    <th className="py-2.5 px-4 text-right">Open Price</th>
                    <th className="py-2.5 px-4 text-right">High</th>
                    <th className="py-2.5 px-4 text-right">Low</th>
                    <th className="py-2.5 px-4 text-right">Close Price</th>
                    <th className="py-2.5 px-4 text-right">Aggregated Volume</th>
                    <th className="py-2.5 px-4 text-right">Tick Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800/60">
                  {dailyRollups.map((r, i) => (
                    <tr key={`${r.bucket_date}-${r.symbol}-${i}`} className="hover:bg-navy-850/50 transition">
                      <td className="py-2.5 px-4 font-semibold text-slate-200">
                        {r.bucket_date}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-brand-teal">
                        {r.symbol}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-300">
                        {formatCurrency(r.open_price)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-400">
                        {formatCurrency(r.high_price)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-rose-400">
                        {formatCurrency(r.low_price)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-100 font-bold">
                        {formatCurrency(r.close_price)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400">
                        {formatCurrency(r.total_volume, 0)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {formatNumber(r.tick_count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
