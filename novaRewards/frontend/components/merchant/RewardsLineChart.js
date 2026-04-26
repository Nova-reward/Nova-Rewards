'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { useChartTheme } from '../analytics/useChartTheme';

/**
 * Line chart showing daily reward issuance.
 * @param {{ data: Array<{ date: string, issued: number }> }} props
 */
export default function RewardsLineChart({ data }) {
  const c = useChartTheme();

  const formatted = useMemo(
    () => data?.map((d) => ({ ...d, date: d.date.slice(5) })) ?? [],
    [data]
  );

  const tooltipStyle = {
    backgroundColor: c.tooltip.bg,
    border: `1px solid ${c.tooltip.border}`,
    color: c.tooltip.color,
  };

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={formatted} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
        <XAxis dataKey="date" tick={{ fill: c.text, fontSize: 11 }} />
        <YAxis tick={{ fill: c.text, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v.toLocaleString(), 'NOVA Issued']} />
        <Line type="monotone" dataKey="issued" stroke={c.accent} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
