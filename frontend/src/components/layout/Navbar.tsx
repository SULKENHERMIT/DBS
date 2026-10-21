import React from 'react';
import { Database, RefreshCw, Activity, ShieldCheck, Clock } from 'lucide-react';
import { HealthStatus } from '../../types';
import { formatDateTime } from '../../lib/formatters';

interface NavbarProps {
  health: HealthStatus | null;
  loading: boolean;
  onRefresh: () => void;
  lastUpdated: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  loading,
  onRefresh,
  lastUpdated,
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-navy-800 bg-navy-900/90 px-4 md:px-6 backdrop-blur-md">
      {/* Brand & Platform Identity */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-teal/20 to-brand-emerald/10 border border-brand-teal/30 text-brand-teal shadow-inner">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-slate-100">
              Live Crypto & Stock Analytics
            </h1>
            <span className="hidden sm:inline-flex items-center rounded-md bg-brand-teal/10 px-2 py-0.5 text-[11px] font-semibold text-brand-teal border border-brand-teal/20">
              TimescaleDB
            </span>
          </div>
          <p className="hidden md:block text-xs text-slate-400">
            High-Performance Time-Series Market Platform
          </p>
        </div>
      </div>

      {/* Right Side Status & Actions */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Data Origin Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-lg bg-navy-850 px-2.5 py-1.5 border border-navy-800 text-xs text-slate-300">
          <Clock className="h-3.5 w-3.5 text-brand-teal" />
          <span>Last Observation:</span>
          <span className="font-medium text-slate-200 font-tabular">
            {lastUpdated ? formatDateTime(lastUpdated) : 'Historical Dataset'}
          </span>
        </div>

        {/* Database Health Badge */}
        <div className="flex items-center gap-2 rounded-lg bg-navy-850 px-3 py-1.5 border border-navy-800 text-xs">
          <Database className="h-3.5 w-3.5 text-brand-emerald" />
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-slate-200">
              {health?.database_engine || 'TimescaleDB Connected'}
            </span>
          </div>
          <span className="hidden sm:inline text-slate-500">•</span>
          <span className="hidden sm:inline text-slate-400 font-mono text-[11px]">
            Port 5433
          </span>
        </div>

        {/* Manual Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh real-time data from TimescaleDB"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-navy-700 bg-navy-800 text-slate-300 hover:bg-navy-700 hover:text-white transition disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand-teal' : ''}`} />
        </button>
      </div>
    </header>
  );
};
