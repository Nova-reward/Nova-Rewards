'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

/**
 * DataTable — shared, accessible table component.
 *
 * Props:
 *   columns        [{ key, label, sortable?, render? }]
 *   data           array of row objects
 *   defaultPageSize  10 | 25 | 50  (default: 10)
 *   emptyState     ReactNode — custom empty state content
 *   keyField       string — field used as React key (default: 'id')
 *   urlSync        boolean — reflect sort/page in URL query string (default: true)
 *   queryPrefix    string — prefix for URL params to avoid collisions (default: '')
 *   loading        boolean — show skeleton rows while true
 *   skeletonRows   number — how many skeleton rows to show (default: 5)
 *   className      string — extra classes on the root wrapper
 */
export default function DataTable({
  columns = [],
  data = [],
  defaultPageSize = 10,
  emptyState,
  keyField = 'id',
  urlSync = true,
  queryPrefix = '',
  loading = false,
  skeletonRows = 5,
  className = '',
}) {
  const router = useRouter();

  // ── Derive initial state from URL (if urlSync) ──────────────────────────
  const getInitialState = useCallback(() => {
    if (!urlSync || typeof window === 'undefined') {
      return { sortKey: null, sortDir: 'asc', page: 1, pageSize: defaultPageSize };
    }
    const params = new URLSearchParams(window.location.search);
    const pk = queryPrefix;
    return {
      sortKey:  params.get(`${pk}sort`)    || null,
      sortDir:  params.get(`${pk}dir`) === 'desc' ? 'desc' : 'asc',
      page:     Math.max(1, parseInt(params.get(`${pk}page`) || '1', 10)),
      pageSize: [10, 25, 50].includes(parseInt(params.get(`${pk}size`) || '', 10))
        ? parseInt(params.get(`${pk}size`), 10)
        : defaultPageSize,
    };
  }, [urlSync, queryPrefix, defaultPageSize]);

  const init = getInitialState();
  const [sortKey,  setSortKey]  = useState(init.sortKey);
  const [sortDir,  setSortDir]  = useState(init.sortDir);
  const [page,     setPage]     = useState(init.page);
  const [pageSize, setPageSize] = useState(init.pageSize);

  // ── Sync state → URL ────────────────────────────────────────────────────
  useEffect(() => {
    if (!urlSync || !router.isReady) return;
    const pk = queryPrefix;
    const current = { ...router.query };

    // Build the new params
    if (sortKey) {
      current[`${pk}sort`] = sortKey;
      current[`${pk}dir`]  = sortDir;
    } else {
      delete current[`${pk}sort`];
      delete current[`${pk}dir`];
    }
    if (page > 1) {
      current[`${pk}page`] = String(page);
    } else {
      delete current[`${pk}page`];
    }
    if (pageSize !== defaultPageSize) {
      current[`${pk}size`] = String(pageSize);
    } else {
      delete current[`${pk}size`];
    }

    router.replace({ query: current }, undefined, { shallow: true, scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sortDir, page, pageSize, urlSync, queryPrefix]);

  // ── Sort ────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  // ── Paginate ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handlePageSize = (size) => {
    setPageSize(size);
    setPage(1);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className={`w-full ${className}`}>
      {/* Horizontally scrollable table wrapper */}
      <div className="overflow-x-auto w-full rounded-xl border border-slate-200 dark:border-brand-border">
        <table
          className="w-full text-sm min-w-[600px]"
          role="grid"
          aria-label="Data table"
          aria-rowcount={sorted.length}
          aria-busy={loading}
        >
          <caption className="sr-only">
            {sorted.length} row{sorted.length !== 1 ? 's' : ''}
          </caption>

          {/* ── Head ── */}
          <thead className="bg-slate-50 dark:bg-brand-card text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wide">
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const canSort  = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    onClick={canSort ? () => handleSort(col.key) : undefined}
                    className={[
                      'px-4 py-3 text-left font-semibold whitespace-nowrap select-none',
                      canSort
                        ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors'
                        : '',
                      isSorted ? 'text-slate-800 dark:text-slate-100' : '',
                    ].join(' ')}
                    aria-sort={
                      isSorted
                        ? sortDir === 'asc' ? 'ascending' : 'descending'
                        : canSort ? 'none' : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {canSort && (
                        <SortIcon active={isSorted} dir={sortDir} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody className="divide-y divide-slate-100 dark:divide-brand-border">
            {loading ? (
              // Skeleton rows
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="bg-white dark:bg-brand-card">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 rounded bg-slate-100 dark:bg-brand-border animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              // Empty state
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-slate-500 dark:text-slate-400"
                >
                  {emptyState ?? (
                    <DefaultEmptyState />
                  )}
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => {
                const rowKey = row[keyField] ?? i;
                return (
                  <tr
                    key={rowKey}
                    className="bg-white dark:bg-brand-card hover:bg-slate-50 dark:hover:bg-brand-border/30 transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3 text-slate-800 dark:text-slate-200"
                      >
                        {col.render
                          ? col.render(row[col.key], row)
                          : (row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination bar ── */}
      {!loading && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-sm text-slate-500 dark:text-slate-400">
          {/* Row count */}
          <span>
            {sorted.length === 0
              ? '0 results'
              : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} of ${sorted.length}`}
          </span>

          {/* Page controls */}
          <div className="flex items-center gap-1">
            <PaginationButton
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              aria-label="First page"
            >
              «
            </PaginationButton>
            <PaginationButton
              onClick={() => setPage((p) => p - 1)}
              disabled={safePage === 1}
              aria-label="Previous page"
            >
              ‹
            </PaginationButton>
            <span className="px-3 py-1.5 text-slate-600 dark:text-slate-300 font-medium">
              {safePage} / {totalPages}
            </span>
            <PaginationButton
              onClick={() => setPage((p) => p + 1)}
              disabled={safePage === totalPages}
              aria-label="Next page"
            >
              ›
            </PaginationButton>
            <PaginationButton
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              aria-label="Last page"
            >
              »
            </PaginationButton>
          </div>

          {/* Page size selector */}
          <label className="flex items-center gap-2">
            <span className="text-xs">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSize(Number(e.target.value))}
              className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-purple/50 cursor-pointer"
              aria-label="Rows per page"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SortIcon({ active, dir }) {
  return (
    <span
      className={`inline-flex flex-col leading-none transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}
      aria-hidden="true"
    >
      <span
        className={`text-[9px] leading-none ${active && dir === 'asc' ? 'text-brand-purple' : ''}`}
      >
        ▲
      </span>
      <span
        className={`text-[9px] leading-none ${active && dir === 'desc' ? 'text-brand-purple' : ''}`}
      >
        ▼
      </span>
    </span>
  );
}

function PaginationButton({ children, disabled, onClick, 'aria-label': ariaLabel }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="touch-target min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-brand-border/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-base font-medium"
    >
      {children}
    </button>
  );
}

function DefaultEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <span className="text-3xl" aria-hidden="true">📭</span>
      <p className="font-medium text-slate-700 dark:text-slate-300">No results</p>
      <p className="text-xs text-slate-400">Nothing to display here yet.</p>
    </div>
  );
}
