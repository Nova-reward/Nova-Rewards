'use client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useChartTheme } from '../analytics/useChartTheme';
import ChartEmptyState from './ChartEmptyState';

/**
 * Donut chart for redemption breakdown.
 * Issue #618
 */
export default function RedemptionDonutChart({ data = [], loading = false, error = null }) {
  const { text, tooltip, palette } = useChartTheme();

  if (loading) return <ChartEmptyState type="loading" />;
  if (error)   return <ChartEmptyState type="error" message={error} />;
  if (!data.length) return <ChartEmptyState type="empty" />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="75%"
          paddingAngle={3}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: tooltip.bg, border: `1px solid ${tooltip.border}`, color: tooltip.color }}
          formatter={(value) => [value.toLocaleString(), '']}
        />
        <Legend
          wrapperStyle={{ color: text, fontSize: 12 }}
          formatter={(value) => value}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
