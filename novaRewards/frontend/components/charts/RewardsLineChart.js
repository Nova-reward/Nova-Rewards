'use client';

import { useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Brush,
} from 'recharts';
import { useChartTheme } from '../analytics/useChartTheme';
import ChartEmptyState from './ChartEmptyState';

/** Custom tooltip showing date, amount, and transaction type. */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      role="tooltip"
      className="rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{
        background: payload[0]?.payload?._tooltipBg ?? '#fff',
        borderColor: payload[0]?.payload?._tooltipBorder ?? '#cbd5e1',
        color: payload[0]?.payload?._tooltipColor ?? '#0f172a',
        minWidth: 160,
      }}
    >
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: <strong>{entry.value?.toLocaleString()}</strong>
        </p>
      ))}
      {payload[0]?.payload?.type && (
        <p className="mt-1 capitalize opacity-70">Type: {payload[0].payload.type}</p>
      )}
    </div>
  );
}

/**
 * Keyboard-accessible legend that toggles series visibility.
 * Each item is a button so it receives focus and responds to Enter/Space.
 */
function AccessibleLegend({ series, hidden, onToggle, palette }) {
  return (
    <ul role="list" className="flex flex-wrap gap-3 justify-center mt-2" aria-label="Chart legend">
      {series.map((s, i) => {
        const isHidden = hidden.has(s.key);
        return (
          <li key={s.key}>
            <button
              type="button"
              role="checkbox"
              aria-checked={!isHidden}
              onClick={() => onToggle(s.key)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle(s.key)}
              className="flex items-center gap-1.5 text-xs rounded px-2 py-1 border transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{
                borderColor: palette[i % palette.length],
                opacity: isHidden ? 0.4 : 1,
                color: palette[i % palette.length],
              }}
            >
              <span
                aria-hidden="true"
                className="inline-block w-3 h-0.5 rounded"
                style={{ background: palette[i % palette.length] }}
              />
              {s.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * RewardsLineChart — time-series chart with:
 *  - Custom tooltip (date, amount, type)
 *  - Brush-based scroll/pinch zoom
 *  - Click-to-filter callback (onDateClick)
 *  - Keyboard-accessible legend toggle
 *
 * @param {{
 *   data: Array<{ date: string, rewards?: number, type?: string, [key: string]: any }>,
 *   series?: Array<{ key: string, label: string }>,
 *   loading?: boolean,
 *   error?: string|null,
 *   onDateClick?: (date: string) => void,
 * }} props
 */
export default function RewardsLineChart({
  data = [],
  series,
  loading = false,
  error = null,
  onDateClick,
}) {
  const { text, grid, tooltip, accent, palette } = useChartTheme();

  // Default to a single "rewards" series if none provided
  const resolvedSeries = series ?? [{ key: 'rewards', label: 'Rewards' }];

  const [hidden, setHidden] = useState(new Set());

  const toggleSeries = useCallback((key) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // Inject tooltip theme tokens into each data point so CustomTooltip can read them
  const enriched = data.map((d) => ({
    ...d,
    _tooltipBg: tooltip.bg,
    _tooltipBorder: tooltip.border,
    _tooltipColor: tooltip.color,
  }));

  const handleClick = useCallback(
    (chartData) => {
      if (onDateClick && chartData?.activePayload?.[0]?.payload?.date) {
        onDateClick(chartData.activePayload[0].payload.date);
      }
    },
    [onDateClick]
  );

  if (loading) return <ChartEmptyState type="loading" />;
  if (error)   return <ChartEmptyState type="error" message={error} />;
  if (!data.length) return <ChartEmptyState type="empty" />;

  const tickFormatter = (v) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000   ? `${(v / 1_000).toFixed(1)}k`
    : v;

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={enriched}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          onClick={onDateClick ? handleClick : undefined}
          style={onDateClick ? { cursor: 'pointer' } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="date" tick={{ fill: text, fontSize: 12 }} />
          <YAxis
            tick={{ fill: text, fontSize: 12 }}
            tickFormatter={tickFormatter}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Brush provides scroll-to-zoom on desktop and pinch-to-zoom on mobile */}
          <Brush
            dataKey="date"
            height={24}
            stroke={accent}
            fill={tooltip.bg}
            travellerWidth={8}
            tickFormatter={(v) => v}
          />
          {resolvedSeries.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={palette[i % palette.length]}
              strokeWidth={2}
              dot={data.length === 1 ? { r: 5, fill: palette[i % palette.length] } : false}
              activeDot={{ r: 6 }}
              name={s.label}
              hide={hidden.has(s.key)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <AccessibleLegend
        series={resolvedSeries}
        hidden={hidden}
        onToggle={toggleSeries}
        palette={palette}
      />
    </div>
  );
}
