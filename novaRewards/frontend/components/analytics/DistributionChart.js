'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useChartTheme } from './useChartTheme';

/**
 * Doughnut chart: reward type distribution.
 * @param {{ data: Array<{ name: string, value: number }> }} props
 */
export default function DistributionChart({ data }) {
  const c = useChartTheme();
  const tooltipStyle = { backgroundColor: c.tooltip.bg, border: `1px solid ${c.tooltip.border}`, color: c.tooltip.color };
  const slices = useMemo(() => data ?? [], [data]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={slices}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
        >
          {slices.map((_, i) => (
            <Cell key={i} fill={c.palette[i % c.palette.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [`${v}%`, 'Share']}
        />
        <Legend
          wrapperStyle={{ color: c.text, fontSize: 12 }}
          formatter={(value) => <span style={{ color: c.text }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
