import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import DashboardLayout from '../components/layout/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';
import KpiCards from '../components/merchant/KpiCards';
import CampaignList from '../components/merchant/CampaignList';
import DateRangePicker from '../components/analytics/DateRangePicker';
import {
  fetchMerchantKpis,
  fetchDailyIssuance,
  fetchMerchantCampaigns,
  pauseCampaign,
  resumeCampaign,
} from '../lib/merchantDashboardApi';

// Recharts uses browser APIs — skip SSR
const RewardsLineChart = dynamic(
  () => import('../components/merchant/RewardsLineChart'),
  { ssr: false }
);

const REFRESH_INTERVAL = 60_000; // 60 seconds

function MerchantDashboardContent() {
  const [range, setRange] = useState('30d');
  const [kpis, setKpis] = useState(null);
  const [issuance, setIssuance] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const timerRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [k, i, c] = await Promise.all([
        fetchMerchantKpis(range),
        fetchDailyIssuance(range),
        fetchMerchantCampaigns(),
      ]);
      setKpis(k);
      setIssuance(i);
      setCampaigns(c);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [range]);

  // Load on mount and when range changes
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-refresh every 60s
  useEffect(() => {
    timerRef.current = setInterval(loadAll, REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [loadAll]);

  async function handlePause(id) {
    try {
      await pauseCampaign(id);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'paused' } : c))
      );
    } catch {
      // silently ignore — user can retry via Manage link
    }
  }

  async function handleResume(id) {
    try {
      await resumeCampaign(id);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'active' } : c))
      );
    } catch {
      // silently ignore
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold dark:text-white">📊 Merchant Dashboard</h1>
          {lastRefreshed && (
            <p className="text-xs text-slate-400 mt-1">
              Last updated: {lastRefreshed.toLocaleTimeString()} · auto-refreshes every 60s
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button
            className="touch-target px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card hover:bg-slate-50 dark:hover:bg-brand-border transition-colors"
            onClick={loadAll}
            disabled={loading}
            aria-label="Refresh dashboard data"
          >
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 text-center">
          <p className="text-red-600 dark:text-red-400 text-sm mb-2">⚠️ {error}</p>
          <button className="touch-target px-4 py-2 text-sm rounded-lg bg-white dark:bg-brand-card border border-slate-200 dark:border-brand-border" onClick={loadAll}>Try Again</button>
        </div>
      )}

      {/* KPI Cards */}
      <KpiCards kpis={kpis} loading={loading} />

      {/* Daily Issuance Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 md:p-6 shadow-sm">
        <h2 className="text-base font-semibold dark:text-white mb-4">🎁 Daily Reward Issuance</h2>
        {loading ? (
          <div className="h-60 rounded-lg bg-slate-100 dark:bg-brand-border animate-pulse" />
        ) : (
          <RewardsLineChart data={issuance} />
        )}
      </div>

      {/* Campaign List */}
      <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 md:p-6 shadow-sm">
        <h2 className="text-base font-semibold dark:text-white mb-4">🚀 Campaigns</h2>
        <CampaignList
          campaigns={campaigns}
          loading={loading}
          onPause={handlePause}
          onResume={handleResume}
        />
      </div>
    </div>
  );
}

function MerchantDashboardPage() {
  return (
    <ErrorBoundary>
      <MerchantDashboardContent />
    </ErrorBoundary>
  );
}

MerchantDashboardPage.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default withAuth(MerchantDashboardPage);
