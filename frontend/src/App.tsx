import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { MarketOverview } from './pages/MarketOverview';
import { AssetDetails } from './pages/AssetDetails';
import { PortfolioAnalytics } from './pages/PortfolioAnalytics';
import { AlertsView } from './pages/AlertsView';
import { TimescaleDBDiagnostics } from './pages/TimescaleDBDiagnostics';
import { QueryWorkbench } from './pages/QueryWorkbench';
import { SystemStatusView } from './pages/SystemStatus';
import { HealthStatus, MarketSummary, WatchlistItem } from './types';
import { api } from './lib/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('market');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC');

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleSelectAsset = (sym: string) => {
    setSelectedSymbol(sym);
    setActiveTab('asset');
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchCoreData() {
      setLoading(true);
      try {
        const [healthRes, summaryRes, watchlistRes] = await Promise.all([
          api.getHealth().catch(() => null),
          api.getMarketSummary().catch(() => null),
          api.getWatchlist().catch(() => []),
        ]);
        if (isMounted) {
          setHealth(healthRes);
          setSummary(summaryRes);
          setWatchlist(watchlistRes);
        }
      } catch (err) {
        console.error('Core data load error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchCoreData();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        health={health}
        loading={loading}
        onRefresh={handleRefresh}
        lastUpdated={summary?.latest_update || null}
      />

      {/* Main App Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          selectedSymbol={selectedSymbol}
        />

        {/* Content View Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-navy-950">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'market' && (
              <MarketOverview
                summary={summary}
                watchlist={watchlist}
                loading={loading}
                onSelectAsset={handleSelectAsset}
              />
            )}

            {activeTab === 'asset' && (
              <AssetDetails
                symbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
                onBackToOverview={() => setActiveTab('market')}
              />
            )}

            {activeTab === 'portfolio' && <PortfolioAnalytics />}

            {activeTab === 'alerts' && <AlertsView />}

            {activeTab === 'timeseries' && <TimescaleDBDiagnostics />}

            {activeTab === 'query-workbench' && <QueryWorkbench />}

            {activeTab === 'system' && <SystemStatusView />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
