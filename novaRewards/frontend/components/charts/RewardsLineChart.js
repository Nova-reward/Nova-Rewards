'use client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useChartTheme } from '../analytics/useChartTheme';
import ChartEmptyState from './ChartEmptyState';

/**
 * Line chart for time-series reward data.
 * Handles empty, single-point, and large-number edge cases.
 * Issue #618
 */
export default function RewardsLineChart({ data = [], loading = false, error = null }) {
  const { text, grid, tooltip, accent } = useChartTheme();

  if (loading) return <ChartEmptyState type="loading" />;
  if (error)   return <ChartEmptyState type="error" message={error} />;
  if (!data.length) return <ChartEmptyState type="empty" />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
        <XAxis dataKey="date" tick={{ fill: text, fontSize: 12 }} />
        <YAxis
          tick={{ fill: text, fontSize: 12 }}
          tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}k` : v)}
          width={56}
        />
        <Tooltip
          contentStyle={{ background: tooltip.bg, border: `1px solid ${tooltip.border}`, color: tooltip.color }}
        />
        <Legend wrapperStyle={{ color: text, fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="rewards"
          stroke={accent}
          strokeWidth={2}
          dot={data.length === 1 ? { r: 5, fill: accent } : false}
          activeDot={{ r: 6 }}
          name="Rewards"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
