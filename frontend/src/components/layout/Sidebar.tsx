import React from 'react';
import {
  TrendingUp,
  CandlestickChart as CandleIcon,
  Briefcase,
  Bell,
  Cpu,
  Server,
  Layers,
  Terminal,
} from 'lucide-react';

export type NavTab = 'market' | 'asset' | 'portfolio' | 'alerts' | 'timeseries' | 'query-workbench' | 'system';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  selectedSymbol: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  selectedSymbol,
}) => {
  const navItems = [
    {
      id: 'market' as NavTab,
      label: 'Market Overview',
      sublabel: 'Catalog & Watchlist',
      icon: TrendingUp,
    },
    {
      id: 'asset' as NavTab,
      label: `Asset Details (${selectedSymbol})`,
      sublabel: 'Candlesticks & Ticks',
      icon: CandleIcon,
    },
    {
      id: 'portfolio' as NavTab,
      label: 'Portfolio Analytics',
      sublabel: 'Holdings & Valuation',
      icon: Briefcase,
    },
    {
      id: 'alerts' as NavTab,
      label: 'Alerts & Dispatch',
      sublabel: 'Triggers & Channels',
      icon: Bell,
    },
    {
      id: 'timeseries' as NavTab,
      label: 'TimescaleDB Engine',
      sublabel: 'Chunks & Compression',
      icon: Cpu,
    },
    {
      id: 'query-workbench' as NavTab,
      label: 'SQL Query Workbench',
      sublabel: 'Build Mode & Code Mode',
      icon: Terminal,
    },
    {
      id: 'system' as NavTab,
      label: 'System & Status',
      sublabel: 'Database Diagnostics',
      icon: Server,
    },
  ];

  return (
    <aside className="w-full md:w-64 shrink-0 border-r border-navy-800 bg-navy-950 p-4 flex flex-col justify-between">
      <div className="space-y-6">
        {/* Navigation Category */}
        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Analytics & Views
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                    isActive
                      ? 'bg-navy-850 text-brand-teal font-medium border border-navy-700/80 shadow-sm'
                      : 'text-slate-400 hover:bg-navy-900 hover:text-slate-200'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-brand-teal' : 'text-slate-500'
                    }`}
                  />
                  <div className="truncate">
                    <div className="text-xs truncate">{item.label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{item.sublabel}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Database Technology Callout */}
        <div className="rounded-xl bg-navy-900/60 border border-navy-800/80 p-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-semibold mb-1">
            <Layers className="h-4 w-4 text-brand-teal" />
            <span>Architecture</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Directly querying 18 tables, <code className="text-brand-teal font-mono">price_history</code> hypertable (15 chunks), and materialized continuous aggregates.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-navy-800/60 text-[11px] text-slate-500">
        <div>Platform: DA-3 Implementation</div>
        <div className="font-mono text-[10px] text-slate-600">Container: timescale-crypto</div>
      </div>
    </aside>
  );
};
