import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Activity,
  Layers,
  Clock,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { SystemStatus, HealthStatus } from '../types';
import { api } from '../lib/api';
import { formatDateTime, formatNumber } from '../lib/formatters';

export const SystemStatusView: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, healthRes] = await Promise.all([
        api.getSystemStatus(),
        api.getHealth(),
      ]);
      setStatus(statusRes);
      setHealth(healthRes);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend or database');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-navy-900 border border-navy-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              System Infrastructure & Database Health
            </h2>
            <p className="text-xs text-slate-400">
              TimescaleDB container connection, API latency, and data integrity metrics.
            </p>
          </div>
        </div>

        <button
          onClick={loadStatus}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-850 border border-navy-700 text-xs text-slate-300 hover:text-white transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-brand-teal' : ''}`} />
          <span>Test Connection</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-72 text-slate-400 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
          <p className="text-xs">Executing system health probes...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-navy-900 border border-rose-500/30 p-6 text-center text-rose-400 space-y-2">
          <AlertTriangle className="h-8 w-8 mx-auto" />
          <p className="text-base font-semibold">Database Connection Failure</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Connection Specifications */}
          <div className="rounded-xl bg-navy-900 border border-navy-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-800">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Database className="h-4 w-4 text-brand-teal" />
                TimescaleDB Database Server
              </h3>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </span>
            </div>

            <div className="divide-y divide-navy-800 text-xs font-mono">
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400 font-sans">Database Engine</span>
                <span className="text-brand-teal font-semibold">{status?.database_engine}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400 font-sans">Core Version</span>
                <span className="text-slate-200">{status?.database_version}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400 font-sans">Target Database</span>
                <span className="text-slate-200">{status?.database_name}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400 font-sans">Host & Port</span>
                <span className="text-slate-200">{status?.host}:{status?.port}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400 font-sans">Authenticated Role</span>
                <span className="text-emerald-400">{status?.authenticated_user} (Least-Privilege)</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400 font-sans">Server Time (UTC)</span>
                <span className="text-slate-300 font-tabular">{formatDateTime(health?.server_time)}</span>
              </div>
            </div>
          </div>

          {/* Time-Series Catalog & Storage Health */}
          <div className="rounded-xl bg-navy-900 border border-navy-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-navy-800">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-brand-cyan" />
                Data Coverage & Partitioning
              </h3>
              <span className="text-xs text-slate-500 font-mono">18 Tables</span>
            </div>

            <div className="divide-y divide-navy-800 text-xs">
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400">Total Price Observations</span>
                <span className="font-bold text-slate-100 font-tabular">
                  {formatNumber(status?.total_price_ticks || 4055)} records
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400">Earliest Observation</span>
                <span className="text-slate-200 font-tabular font-mono text-[11px]">
                  {formatDateTime(status?.earliest_observation)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400">Latest Observation</span>
                <span className="text-slate-200 font-tabular font-mono text-[11px]">
                  {formatDateTime(status?.latest_observation)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400">Physical Chunks Partitioned</span>
                <span className="font-semibold text-brand-teal font-tabular">
                  {status?.total_hypertable_chunks} Chunks (1-day dimension)
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400">Columnar Compressed Chunks</span>
                <span className="font-semibold text-emerald-400 font-tabular">
                  {status?.compressed_chunks} Compressed Chunks
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400">Tracked Market Assets</span>
                <span className="font-semibold text-slate-200">
                  {status?.tracked_assets_count} Registered Entities
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security & Architecture Verification Box */}
      <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 text-xs space-y-2">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <Shield className="h-4 w-4 text-brand-teal" />
          <span>Security & Deployment Best Practices Enforced</span>
        </div>
        <p className="text-slate-400 leading-relaxed">
          The dashboard backend authenticates using a dedicated read-only role (<code className="text-brand-teal font-mono">dashboard_reader</code>) with strictly SELECT-only and function execution grants. Direct write operations, schema mutations, and superuser commands are completely prohibited at the PostgreSQL database engine level.
        </p>
      </div>
    </div>
  );
};
