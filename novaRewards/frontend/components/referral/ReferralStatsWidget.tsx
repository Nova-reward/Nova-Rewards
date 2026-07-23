'use client';

import React from 'react';
import { useReferral } from '../../hooks/useReferral';

interface ReferralStatsWidgetProps {
  userId: string | number | null | undefined;
  className?: string;
}

interface StatItemProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
}

function StatItem({ label, value, icon, accent = 'text-primary-600 dark:text-primary-400' }: StatItemProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-700/50 dark:bg-neutral-700/30">
      <div className={`mt-0.5 shrink-0 ${accent}`} aria-hidden="true">{icon}</div>
      <div>
        <p className="text-lg font-bold leading-tight text-neutral-800 dark:text-neutral-100">{value}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      </div>
    </div>
  );
}

/**
 * ReferralStatsWidget — displays a summary of the user's referral performance.
 * Shows total, pending, confirmed referrals, and tokens earned.
 *
 * Accessible: landmark, aria labels, loading states.
 * Dark-mode aware.
 */
export function ReferralStatsWidget({ userId, className = '' }: ReferralStatsWidgetProps) {
  const { stats, isLoading, error, refresh } = useReferral(userId);

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading referral stats"
        className={`animate-pulse rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-800 ${className}`}
      >
        <div className="mb-4 h-4 w-1/3 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Referral statistics"
      className={`rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
          Referral stats
        </h2>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh referral stats"
          className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <StatItem
          label="Total referrals"
          value={stats?.totalReferrals ?? 0}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatItem
          label="Pending"
          value={stats?.pendingReferrals ?? 0}
          accent="text-amber-500 dark:text-amber-400"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatItem
          label="Confirmed"
          value={stats?.confirmedReferrals ?? 0}
          accent="text-green-600 dark:text-green-400"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatItem
          label="Tokens earned"
          value={`${stats?.tokensEarned ?? 0} NOVA`}
          accent="text-violet-600 dark:text-violet-400"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </dl>

      {error && (
        <p role="alert" className="mt-3 text-xs text-amber-600 dark:text-amber-400">{error}</p>
      )}
    </section>
  );
}

export default ReferralStatsWidget;
