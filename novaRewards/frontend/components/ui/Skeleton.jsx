import React, { useEffect, useState } from 'react';

/** Base shimmer block — composable building block for all skeletons. */
export function SkeletonBlock({ className = '', style = {} }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded bg-neutral-200 dark:bg-neutral-700 overflow-hidden relative ${className}`}
      style={style}
    >
      <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
    </div>
  );
}

/**
 * SkeletonText — one or more lines of text placeholder.
 * @param {number} lines
 * @param {string} className  applied to each line
 */
export function SkeletonText({ lines = 1, className = '' }) {
  return (
    <div role="status" aria-label="Loading text" className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'} ${className}`}
        />
      ))}
    </div>
  );
}

/**
 * SkeletonCard — matches the shape of a campaign/reward card.
 * @param {boolean} showImage
 */
export function SkeletonCard({ showImage = true }) {
  return (
    <div
      role="status"
      aria-label="Loading card"
      className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 flex flex-col gap-3"
    >
      {showImage && <SkeletonBlock className="h-40 w-full rounded-lg" />}
      <SkeletonBlock className="h-4 w-2/3" />
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-3 w-4/5" />
      <SkeletonBlock className="h-9 w-full rounded-lg mt-1" />
    </div>
  );
}

/**
 * SkeletonTable — matches a data table with header + rows.
 * @param {number} rows
 * @param {number} cols
 */
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div role="status" aria-label="Loading table" className="w-full">
      {/* header */}
      <div className="flex gap-4 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex gap-4 px-4 py-4 border-b border-neutral-100 dark:border-neutral-800"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} className={`h-4 flex-1 ${c === 0 ? 'w-1/4' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * withSkeletonTimeout — HOC that shows skeleton for up to 10 s,
 * then renders an error fallback if content hasn't loaded.
 *
 * @param {React.ComponentType} SkeletonComponent
 * @param {React.ComponentType} ErrorFallback
 * @param {number} timeout  ms (default 10 000)
 */
export function withSkeletonTimeout(SkeletonComponent, ErrorFallback, timeout = 10000) {
  return function TimedSkeleton({ isLoading, children, ...props }) {
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
      if (!isLoading) return;
      const id = setTimeout(() => setTimedOut(true), timeout);
      return () => clearTimeout(id);
    }, [isLoading]);

    if (!isLoading) return children;
    if (timedOut) return ErrorFallback ? <ErrorFallback /> : <p className="text-sm text-error-600">Failed to load. Please refresh.</p>;
    return <SkeletonComponent {...props} />;
  };
}

export default SkeletonBlock;
