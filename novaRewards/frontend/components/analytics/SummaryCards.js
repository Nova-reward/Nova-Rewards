'use client';

import AnimatedCounter from '../ui/AnimatedCounter';

/**
 * Four quick-stat summary cards.
 * @param {{ summary: object }} props
 */
export default function SummaryCards({ summary }) {
  if (!summary) return null;

  const cards = [
    { key: 'totalRevenue',   label: 'Total Revenue',   icon: '💰', fmt: (v) => `$${Math.round(v).toLocaleString()}` },
    { key: 'activeUsers',    label: 'Active Users',    icon: '👥', fmt: (v) => Math.round(v).toLocaleString() },
    { key: 'conversionRate', label: 'Conversion Rate', icon: '📈', fmt: (v) => `${v.toFixed(1)}%` },
    { key: 'rewardsIssued',  label: 'Rewards Issued',  icon: '🎁', fmt: (v) => Math.round(v).toLocaleString() },
  ];

  return (
    <div className="analytics-summary-grid">
      {cards.map(({ key, label, icon, fmt }) => {
        const { value, change } = summary[key] ?? { value: 0, change: 0 };
        const positive = change >= 0;
        return (
          <div key={key} className="card analytics-stat-card">
            <div className="analytics-stat-icon">{icon}</div>
            <div className="analytics-stat-label">{label}</div>
            <div className="analytics-stat-value">
              <AnimatedCounter value={value} format={fmt} />
            </div>
            <div className={`analytics-stat-change ${positive ? 'positive' : 'negative'}`}>
              {positive ? '▲' : '▼'} {Math.abs(change)}% vs last period
            </div>
          </div>
        );
      })}
    </div>
  );
}
