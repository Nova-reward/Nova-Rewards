'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useChartTheme } from './useChartTheme';

/**
 * Grouped bar chart: Clicks vs Conversions per campaign.
 * @param {{ data: Array<{ campaign: string, clicks: number, conversions: number }> }} props
 */
export default function CampaignChart({ data }) {
  const c = useChartTheme();
  const tooltipStyle = { backgroundColor: c.tooltip.bg, border: `1px solid ${c.tooltip.border}`, color: c.tooltip.color };
  const trimmed = useMemo(() => data ?? [], [data]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={trimmed} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
        <XAxis type="number" tick={{ fill: c.text, fontSize: 11 }} />
        <YAxis type="category" dataKey="campaign" tick={{ fill: c.text, fontSize: 11 }} width={60} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ color: c.text, fontSize: 12 }} />
        <Bar dataKey="clicks"      name="Clicks"      fill={c.palette[2]} radius={[0, 4, 4, 0]} />
        <Bar dataKey="conversions" name="Conversions" fill={c.palette[3]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
