'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';
import { useAnalytics } from '../hooks/useAnalytics';
import SummaryCards from '../components/analytics/SummaryCards';
import DateRangePicker from '../components/analytics/DateRangePicker';
import { exportAnalyticsReport } from '../lib/exportReport';

// Dynamic imports — Recharts uses browser APIs; skip SSR
const GrowthChart       = dynamic(() => import('../components/analytics/GrowthChart'),       { ssr: false });
const EngagementChart   = dynamic(() => import('../components/analytics/EngagementChart'),   { ssr: false });
const CampaignChart     = dynamic(() => import('../components/analytics/CampaignChart'),     { ssr: false });
const DistributionChart = dynamic(() => import('../components/analytics/DistributionChart'), { ssr: false });

/**
 * Analytics Dashboard — Issue #331
 */
function AnalyticsContent() {
  const [range, setRange] = useState('30d');
  const { data, loading, error, refetch } = useAnalytics(range);

  const handleExport = () => exportAnalyticsReport(data, range);

  return (
    <DashboardLayout>
      <div className="dashboard-content">

        {/* Header row */}
        <div className="analytics-header card">
          <div>
            <h2>📊 Analytics Dashboard</h2>
            <p style={{ color: 'var(--muted)', marginTop: '0.2rem', fontSize: '0.9rem' }}>
              Rewards, engagement, and revenue insights
            </p>
          </div>
          <div className="analytics-header-actions">
            <DateRangePicker value={range} onChange={setRange} />
            <button
              className="btn btn-secondary"
              onClick={handleExport}
              disabled={!data || loading}
              aria-label="Export analytics report as CSV"
            >
              ⬇️ Export CSV
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
            <p className="error" style={{ marginBottom: '1rem' }}>⚠️ {error}</p>
            <button className="btn btn-secondary" onClick={refetch}>Try Again</button>
          </div>
        )}

        {/* Summary cards */}
        {loading ? (
          <div className="analytics-summary-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card analytics-stat-card">
                <div className="skeleton-block" style={{ height: '1rem', width: '60%', marginBottom: '0.75rem' }} />
                <div className="skeleton-block" style={{ height: '2rem', width: '80%', marginBottom: '0.5rem' }} />
                <div className="skeleton-block" style={{ height: '0.8rem', width: '50%' }} />
              </div>
            ))}
          </div>
        ) : (
          <SummaryCards summary={data?.summary} />
        )}

        {/* Charts grid */}
        <div className="analytics-charts-grid">

          {/* Growth Trends — full width */}
          <div className="card analytics-chart-wide">
            <h3 className="analytics-chart-title">📈 Revenue &amp; User Growth</h3>
            {loading
              ? <div className="skeleton-block analytics-chart-skeleton" />
              : <GrowthChart data={data?.growth} />
            }
          </div>

          {/* Engagement */}
          <div className="card">
            <h3 className="analytics-chart-title">👥 User Engagement (DAU / WAU)</h3>
            {loading
              ? <div className="skeleton-block analytics-chart-skeleton" />
              : <EngagementChart data={data?.engagement} />
            }
          </div>

          {/* Campaign Performance */}
          <div className="card">
            <h3 className="analytics-chart-title">🚀 Campaign Performance</h3>
            {loading
              ? <div className="skeleton-block analytics-chart-skeleton" />
              : <CampaignChart data={data?.campaigns} />
            }
          </div>

          {/* Reward Distribution */}
          <div className="card">
            <h3 className="analytics-chart-title">🎁 Reward Distribution</h3>
            {loading
              ? <div className="skeleton-block analytics-chart-skeleton" />
              : <DistributionChart data={data?.distribution} />
            }
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}

function Analytics() {
  return (
    <ErrorBoundary>
      <AnalyticsContent />
    </ErrorBoundary>
  );
}

export default withAuth(Analytics);
