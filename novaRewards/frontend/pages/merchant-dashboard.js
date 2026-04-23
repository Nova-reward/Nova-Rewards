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
    <div className="container">
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>📊 Merchant Dashboard</h1>
          {lastRefreshed && (
            <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Last updated: {lastRefreshed.toLocaleTimeString()} · auto-refreshes every 60s
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <DateRangePicker value={range} onChange={setRange} />
          <button
            className="btn btn-secondary"
            onClick={loadAll}
            disabled={loading}
            aria-label="Refresh dashboard data"
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          >
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="error" style={{ marginBottom: '0.75rem' }}>⚠️ {error}</p>
          <button className="btn btn-secondary" onClick={loadAll}>Try Again</button>
        </div>
      )}

      {/* KPI Cards */}
      <KpiCards kpis={kpis} loading={loading} />

      {/* Daily Issuance Chart */}
      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>🎁 Daily Reward Issuance</h2>
        {loading ? (
          <div className="skeleton-block" style={{ height: 240, borderRadius: 8 }} />
        ) : (
          <RewardsLineChart data={issuance} />
        )}
      </div>

      {/* Campaign List */}
      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>🚀 Campaigns</h2>
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
