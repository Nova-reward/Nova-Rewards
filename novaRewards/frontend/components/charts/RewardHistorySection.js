'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import RewardsHistory from '../RewardsHistory';

// Skip SSR — Recharts uses browser APIs
const RewardsLineChart = dynamic(
  () => import('../charts/RewardsLineChart'),
  { ssr: false, loading: () => <div className="h-72 rounded-lg bg-slate-100 dark:bg-brand-border animate-pulse" /> }
);

/**
 * RewardHistorySection — chart + transaction list with shared date-filter state.
 *
 * Clicking a data point on the chart sets dateFrom/dateTo to that day and
 * filters the transaction list below. The date inputs in the list also update
 * the chart's highlighted range via the same state.
 *
 * @param {{ userId: string, chartData?: Array<{ date: string, rewards: number, type?: string }> }} props
 */
export default function RewardHistorySection({ userId, chartData = [] }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  /** Called when the user clicks a data point on the chart. */
  const handleDateClick = useCallback((date) => {
    setDateFrom(date);
    setDateTo(date);
  }, []);

  /** Called when the user edits the date inputs inside RewardsHistory. */
  const handleDateChange = useCallback((from, to) => {
    setDateFrom(from);
    setDateTo(to);
  }, []);

  const hasFilter = dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 md:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-base font-semibold dark:text-white">📈 Rewards Over Time</h2>
          {hasFilter && (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-brand-border text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-brand-border transition-colors"
              aria-label="Clear date filter"
            >
              ✕ Clear filter
            </button>
          )}
        </div>
        <RewardsLineChart
          data={chartData}
          onDateClick={handleDateClick}
        />
        {hasFilter && (
          <p className="text-xs text-slate-400 mt-2 text-center" aria-live="polite">
            Showing transactions for{' '}
            {dateFrom === dateTo ? dateFrom : `${dateFrom}${dateTo ? ` – ${dateTo}` : ''}`}
            . Click another point or clear to reset.
          </p>
        )}
      </div>

      {/* Transaction list — receives the shared date filter */}
      <RewardsHistory
        userId={userId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateChange={handleDateChange}
      />
    </div>
  );
}
