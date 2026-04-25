'use client';

const CARDS = [
  { key: 'totalIssued',   label: 'Total Issued',    icon: '🎁', fmt: (v) => v.toLocaleString() + ' NOVA' },
  { key: 'totalRedeemed', label: 'Total Redeemed',  icon: '✅', fmt: (v) => v.toLocaleString() + ' NOVA' },
  { key: 'activeUsers',   label: 'Active Users',    icon: '👥', fmt: (v) => v.toLocaleString() },
  { key: 'campaignCount', label: 'Campaigns',       icon: '🚀', fmt: (v) => v.toString() },
];

/**
 * KPI summary cards for the merchant dashboard.
 * @param {{ kpis: object|null, loading: boolean }} props
 */
export default function KpiCards({ kpis, loading }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
      {CARDS.map(({ key, label, icon, fmt }) => {
        const stat = kpis?.[key] ?? { value: 0, change: 0 };
        const positive = stat.change >= 0;
        return (
          <div key={key} className="card" style={{ marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }} aria-hidden="true">{icon}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>{label}</div>
            {loading ? (
              <div className="skeleton-block" style={{ height: '1.8rem', width: '70%', margin: '0 auto 0.4rem' }} />
            ) : (
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{fmt(stat.value)}</div>
            )}
            {!loading && stat.change !== 0 && (
              <div style={{ fontSize: '0.75rem', color: positive ? 'var(--success)' : 'var(--error)', marginTop: '0.25rem' }}>
                {positive ? '▲' : '▼'} {Math.abs(stat.change)}% vs last period
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
