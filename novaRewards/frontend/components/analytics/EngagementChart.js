'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useChartTheme } from './useChartTheme';

/**
 * Grouped bar chart: DAU vs WAU per time bucket.
 * @param {{ data: Array<{ label: string, dau: number, wau: number }> }} props
 */
export default function EngagementChart({ data }) {
  const c = useChartTheme();
  const tooltipStyle = { backgroundColor: c.tooltip.bg, border: `1px solid ${c.tooltip.border}`, color: c.tooltip.color };

  const trimmed = useMemo(() => data ?? [], [data]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={trimmed} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
        <XAxis dataKey="label" tick={{ fill: c.text, fontSize: 11 }} />
        <YAxis tick={{ fill: c.text, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ color: c.text, fontSize: 12 }} />
        <Bar dataKey="dau" name="DAU" fill={c.palette[0]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="wau" name="WAU" fill={c.palette[1]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
