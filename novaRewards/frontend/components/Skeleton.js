/**
 * Skeleton primitives with shimmer animation.
 *
 * Exports:
 *   SkeletonBlock            — generic shimmer block (any size)
 *   SkeletonCard             — reward/campaign card
 *   SkeletonRow              — transaction list row
 *   SkeletonNotification     — notification list item
 *   SkeletonDashboard        — dashboard summary grid
 *   SkeletonGrid             — grid of SkeletonCards (rewards page)
 *   SkeletonLeaderboard      — leaderboard table rows
 *   SkeletonAnalytics        — analytics summary + chart placeholders
 *   SkeletonProfile          — profile page layout
 *   SkeletonTransactionHistory — transaction history table
 *   SkeletonMerchantDashboard  — merchant KPI cards + chart + campaign list
 *
 * Accessibility: containers use role="status" + aria-label; inner blocks are
 * aria-hidden so screen readers announce only the live region label.
 */

/** Base shimmer block — all sizes, fully composable. */
export function SkeletonBlock({ className = '', style = {} }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${className}`}
      style={style}
    />
  );
}

/** Card skeleton — reward / campaign card layout. */
export function SkeletonCard({ showImage = true }) {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-5 flex flex-col gap-3"
    >
      {showImage && <SkeletonBlock className="h-40 w-full rounded-lg" />}
      <SkeletonBlock className="h-4 w-2/3" />
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-3 w-4/5" />
      <SkeletonBlock className="h-9 w-full rounded-lg mt-1" />
    </div>
  );
}

/** Row skeleton — transaction / history list row. */
export function SkeletonRow() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-brand-border"
    >
      <SkeletonBlock className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <SkeletonBlock className="h-3.5 w-2/5" />
        <SkeletonBlock className="h-3 w-1/4" />
      </div>
      <SkeletonBlock className="h-3.5 w-14 shrink-0" />
      <SkeletonBlock className="h-3 w-12 shrink-0" />
    </div>
  );
}

/** Notification list item skeleton. */
export function SkeletonNotification() {
  return (
    <div
      aria-hidden="true"
      className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-brand-border"
    >
      <SkeletonBlock className="h-6 w-6 rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <SkeletonBlock className="h-3.5 w-full" />
        <SkeletonBlock className="h-3 w-2/5" />
      </div>
    </div>
  );
}

/** Dashboard skeleton — balance cards + recent transactions. */
export function SkeletonDashboard() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      className="space-y-4"
    >
      {/* Summary grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 flex flex-col items-center gap-3"
          >
            <SkeletonBlock className="h-3 w-1/2" />
            <SkeletonBlock className="h-10 w-3/4 rounded-lg" />
            <SkeletonBlock className="h-2.5 w-1/3" />
            <SkeletonBlock className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* Recent transactions card */}
      <div
        aria-hidden="true"
        className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4"
      >
        <SkeletonBlock className="h-4 w-2/5 mb-4" />
        {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  );
}

/** Grid of SkeletonCards — rewards / campaigns page. */
export function SkeletonGrid({ count = 6, showImage = true }) {
  return (
    <div
      role="status"
      aria-label="Loading items"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {[...Array(count)].map((_, i) => (
        <SkeletonCard key={i} showImage={showImage} />
      ))}
    </div>
  );
}

/** Leaderboard skeleton — rank rows. */
export function SkeletonLeaderboard({ rows = 10 }) {
  return (
    <div
      role="status"
      aria-label="Loading leaderboard"
      className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card overflow-hidden"
    >
      {/* Header */}
      <div
        aria-hidden="true"
        className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-brand-border"
      >
        <SkeletonBlock className="h-4 w-8" />
        <SkeletonBlock className="h-4 flex-1" />
        <SkeletonBlock className="h-4 w-20" />
      </div>
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-brand-border last:border-0"
        >
          <SkeletonBlock className="h-4 w-6 shrink-0" />
          <SkeletonBlock className="h-8 w-8 rounded-full shrink-0" />
          <SkeletonBlock className="h-3.5 flex-1" />
          <SkeletonBlock className="h-3.5 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Analytics skeleton — 4 stat cards + 4 chart placeholders. */
export function SkeletonAnalytics() {
  return (
    <div role="status" aria-label="Loading analytics" className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 flex flex-col gap-2"
          >
            <SkeletonBlock className="h-3 w-3/5" />
            <SkeletonBlock className="h-8 w-4/5" />
            <SkeletonBlock className="h-2.5 w-2/5" />
          </div>
        ))}
      </div>

      {/* Wide chart */}
      <div
        aria-hidden="true"
        className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4"
      >
        <SkeletonBlock className="h-4 w-1/3 mb-4" />
        <SkeletonBlock className="h-56 w-full rounded-lg" />
      </div>

      {/* 3-column charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4"
          >
            <SkeletonBlock className="h-4 w-2/3 mb-4" />
            <SkeletonBlock className="h-44 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Profile skeleton — avatar, name, stats, notification toggles. */
export function SkeletonProfile() {
  return (
    <div role="status" aria-label="Loading profile" className="space-y-6">
      {/* Avatar + name */}
      <div
        aria-hidden="true"
        className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-6 flex items-center gap-4"
      >
        <SkeletonBlock className="h-16 w-16 rounded-full shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <SkeletonBlock className="h-5 w-1/3" />
          <SkeletonBlock className="h-3.5 w-1/2" />
        </div>
      </div>

      {/* Stats row */}
      <div
        aria-hidden="true"
        className="grid grid-cols-3 gap-4"
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 flex flex-col items-center gap-2"
          >
            <SkeletonBlock className="h-6 w-1/2" />
            <SkeletonBlock className="h-3 w-3/4" />
          </div>
        ))}
      </div>

      {/* Settings rows */}
      <div
        aria-hidden="true"
        className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 flex flex-col gap-4"
      >
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <SkeletonBlock className="h-4 w-2/5" />
            <SkeletonBlock className="h-6 w-10 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Transaction history skeleton — filter bar + table rows. */
export function SkeletonTransactionHistory({ rows = 8 }) {
  return (
    <div role="status" aria-label="Loading transaction history" className="space-y-4">
      {/* Filter bar */}
      <div
        aria-hidden="true"
        className="flex flex-wrap gap-3"
      >
        {[...Array(4)].map((_, i) => (
          <SkeletonBlock key={i} className="h-9 w-28 rounded-lg" />
        ))}
        <SkeletonBlock className="h-9 w-24 rounded-lg ml-auto" />
      </div>

      {/* Table */}
      <div
        aria-hidden="true"
        className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card overflow-hidden"
      >
        {/* Table header */}
        <div className="flex gap-4 px-4 py-3 border-b border-slate-100 dark:border-brand-border">
          {[40, 80, 60, 80, 60, 48].map((w, i) => (
            <SkeletonBlock key={i} className="h-3.5" style={{ width: w }} />
          ))}
        </div>
        {[...Array(rows)].map((_, i) => <SkeletonRow key={i} />)}
      </div>

      {/* Pagination */}
      <div aria-hidden="true" className="flex items-center justify-between">
        <SkeletonBlock className="h-4 w-20" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-8 w-16 rounded-lg" />
          <SkeletonBlock className="h-8 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Merchant dashboard skeleton — KPI cards + chart + campaign list. */
export function SkeletonMerchantDashboard() {
  return (
    <div role="status" aria-label="Loading merchant dashboard" className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 flex flex-col items-center gap-2"
          >
            <SkeletonBlock className="h-8 w-8 rounded-full" />
            <SkeletonBlock className="h-3 w-3/4" />
            <SkeletonBlock className="h-7 w-1/2" />
          </div>
        ))}
      </div>

      {/* Issuance chart */}
      <div
        aria-hidden="true"
        className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 md:p-6"
      >
        <SkeletonBlock className="h-4 w-1/3 mb-4" />
        <SkeletonBlock className="h-60 w-full rounded-lg" />
      </div>

      {/* Campaign list */}
      <div
        aria-hidden="true"
        className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 md:p-6"
      >
        <SkeletonBlock className="h-4 w-1/4 mb-4" />
        {[...Array(3)].map((_, i) => (
          <SkeletonBlock key={i} className="h-10 w-full rounded-lg mb-2" />
        ))}
      </div>
    </div>
  );
}

export default SkeletonDashboard;
