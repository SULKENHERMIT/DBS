import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Send, Filter, Clock } from 'lucide-react';
import { AlertItem, NotificationItem } from '../types';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/formatters';

export const AlertsView: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'triggered'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAlertsData() {
      setLoading(true);
      setError(null);
      try {
        const [alertList, notifList] = await Promise.all([
          api.getAlerts(statusFilter === 'all' ? undefined : statusFilter),
          api.getNotifications(),
        ]);
        setAlerts(alertList);
        setNotifications(notifList);
      } catch (err: any) {
        setError(err.message || 'Failed to load alerts and notifications');
      } finally {
        setLoading(false);
      }
    }
    loadAlertsData();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-navy-900 border border-navy-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-amber/10 text-brand-amber border border-brand-amber/20">
            <Bell className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Price Threshold Alerts & Notifications
            </h2>
            <p className="text-xs text-slate-400">
              Database trigger-backed price thresholds monitoring asset valuations.
            </p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1 bg-navy-950 border border-navy-700 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-md font-medium transition ${
              statusFilter === 'all'
                ? 'bg-navy-800 text-brand-teal shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1 rounded-md font-medium transition ${
              statusFilter === 'active'
                ? 'bg-navy-800 text-brand-teal shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter('triggered')}
            className={`px-3 py-1 rounded-md font-medium transition ${
              statusFilter === 'triggered'
                ? 'bg-navy-800 text-brand-teal shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Triggered
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-72 text-slate-400 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
          <p className="text-xs">Querying alerts and notification dispatch records...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-navy-900 border border-rose-500/30 p-6 text-center text-rose-400">
          <p className="text-sm font-semibold">Error Loading Alerts</p>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alerts Table (2 cols) */}
          <div className="lg:col-span-2 rounded-xl bg-navy-900 border border-navy-800 overflow-hidden">
            <div className="p-4 border-b border-navy-800">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Configured Price Thresholds
              </h3>
              <p className="text-xs text-slate-400">
                Automated monitors defined in the <code className="font-mono text-brand-teal">alerts</code> table.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-navy-800">
                  <tr>
                    <th className="py-3 px-4">Asset</th>
                    <th className="py-3 px-4 text-right">Threshold</th>
                    <th className="py-3 px-4">Condition</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4 text-right">Created</th>
                    <th className="py-3 px-4 text-right">Triggered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800/60 font-tabular">
                  {alerts.map((al) => (
                    <tr key={al.alert_id} className="hover:bg-navy-850/50 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-100">
                        {al.symbol}
                        <span className="text-slate-400 font-normal ml-1.5 hidden sm:inline">
                          {al.asset_name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-200">
                        {formatCurrency(al.threshold)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            al.direction === 'ABOVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {al.direction} THRESHOLD
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            al.enabled
                              ? 'bg-brand-teal/10 text-brand-teal border border-brand-teal/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {al.enabled ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              Active Monitoring
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3 w-3" />
                              Triggered
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                        {formatDateTime(al.created_at)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                        {al.triggered_at ? formatDateTime(al.triggered_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dispatch Log (1 col) */}
          <div className="rounded-xl bg-navy-900 border border-navy-800 p-4 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Send className="h-4 w-4 text-brand-cyan" />
                Notification Dispatch Log
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Table: <code className="font-mono text-brand-teal">notifications</code>
              </p>
            </div>

            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No notifications recorded yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.notification_id}
                    className="p-3 rounded-lg bg-navy-950 border border-navy-800 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">
                        {n.symbol} {n.direction} {formatCurrency(n.threshold)}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                          n.status === 'SENT'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {n.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Channel: {n.channel}</span>
                      <span className="font-tabular">{formatDateTime(n.sent_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
