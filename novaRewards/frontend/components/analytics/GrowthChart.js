'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useChartTheme } from './useChartTheme';

/**
 * Dual-axis line chart: Revenue (left axis) + User Growth (right axis).
 * @param {{ data: Array<{ date: string, revenue: number, users: number }> }} props
 */
export default function GrowthChart({ data }) {
  const c = useChartTheme();

  const formatted = useMemo(
    () => data?.map((d) => ({ ...d, date: d.date.slice(5) })) ?? [],
    [data]
  );

  const tooltipStyle = { backgroundColor: c.tooltip.bg, border: `1px solid ${c.tooltip.border}`, color: c.tooltip.color };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
        <XAxis dataKey="date" tick={{ fill: c.text, fontSize: 11 }} />
        <YAxis yAxisId="left"  tick={{ fill: c.text, fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: c.text, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ color: c.text, fontSize: 12 }} />
        <Line yAxisId="left"  type="monotone" dataKey="revenue" stroke={c.palette[0]} strokeWidth={2} dot={false} name="Revenue ($)" />
        <Line yAxisId="right" type="monotone" dataKey="users"   stroke={c.palette[1]} strokeWidth={2} dot={false} name="Users" />
      </LineChart>
    </ResponsiveContainer>
  );
}
