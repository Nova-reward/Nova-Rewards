'use client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useChartTheme } from '../analytics/useChartTheme';
import ChartEmptyState from './ChartEmptyState';

/**
 * Bar chart for campaign comparison.
 * Issue #618
 */
export default function CampaignBarChart({ data = [], loading = false, error = null }) {
  const { text, grid, tooltip, palette } = useChartTheme();

  if (loading) return <ChartEmptyState type="loading" />;
  if (error)   return <ChartEmptyState type="error" message={error} />;
  if (!data.length) return <ChartEmptyState type="empty" />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
        <XAxis dataKey="campaign" tick={{ fill: text, fontSize: 12 }} />
        <YAxis
          tick={{ fill: text, fontSize: 12 }}
          tickFormatter={(v) => (v >= 1_000 ? `${(v / 1_000).toFixed(1)}k` : v)}
          width={56}
        />
        <Tooltip
          contentStyle={{ background: tooltip.bg, border: `1px solid ${tooltip.border}`, color: tooltip.color }}
        />
        <Legend wrapperStyle={{ color: text, fontSize: 12 }} />
        <Bar dataKey="issued"   fill={palette[0]} name="Issued"   radius={[4, 4, 0, 0]} />
        <Bar dataKey="redeemed" fill={palette[1]} name="Redeemed" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
