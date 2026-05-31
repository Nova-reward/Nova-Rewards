'use client';

import { useState, useEffect } from 'react';
import { useTransactions } from '../lib/useApi';
import DataTable from './DataTable';

const PAGE_SIZE = 25;
const TRANSACTION_TYPES = ['all', 'issuance', 'redemption', 'transfer'];

function exportCSV(rows) {
  const headers = ['Date', 'Type', 'Amount', 'Campaign', 'Status', 'TX Hash', 'Explorer Link'];
  const lines = rows.map((r) =>
    [
      new Date(r.createdAt).toISOString(),
      r.type,
      r.amount,
      r.campaign?.name || '',
      r.status,
      r.txHash || '',
      `https://stellar.expert/explorer/public/tx/${r.txHash}`,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nova-rewards-history-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Status badge rendered inside the table cell */
function StatusBadge({ status }) {
  const map = {
    confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const cls = map[status] ?? 'bg-slate-100 text-slate-600 dark:bg-brand-border dark:text-slate-400';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

const COLUMNS = [
  {
    key: 'createdAt',
    label: 'Date',
    render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
  },
  {
    key: 'type',
    label: 'Type',
    render: (v) => <span className="capitalize">{v ?? '—'}</span>,
  },
  {
    key: 'amount',
    label: 'Amount',
    render: (v) => (
      <span className="font-semibold text-brand-purple">
        {v != null ? `${parseFloat(v).toFixed(4)} NOVA` : '—'}
      </span>
    ),
  },
  {
    key: 'campaign',
    label: 'Campaign',
    render: (v) => v?.name || '—',
  },
  {
    key: 'status',
    label: 'Status',
    render: (v) => <StatusBadge status={v} />,
  },
  {
    key: 'txHash',
    label: 'Explorer',
    sortable: false,
    render: (v) =>
      v ? (
        <a
          href={`https://stellar.expert/explorer/public/tx/${v}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline font-medium"
        >
          View
        </a>
      ) : (
        '—'
      ),
  },
];

/** Custom empty state for the rewards history table */
function RewardsEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <span className="text-3xl" aria-hidden="true">🎁</span>
      <p className="font-medium text-slate-700 dark:text-slate-300">No rewards found</p>
      <p className="text-xs text-slate-400">
        Transactions will appear here once you start earning or redeeming rewards.
      </p>
    </div>
  );
}

/**
 * RewardsHistory — paginated transaction history with filters and CSV export.
 * Uses the shared DataTable component for consistent sorting, pagination,
 * and URL query string sync.
 */
export default function RewardsHistory({ userId }) {
  const [page, setPage]               = useState(1);
  const [typeFilter, setTypeFilter]   = useState('all');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');

  const filters = {
    limit:  PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    ...(typeFilter !== 'all' && { type: typeFilter }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(campaignFilter !== 'all' && { campaignId: campaignFilter }),
  };

  const { data: transactions, error, isLoading, mutate } = useTransactions(userId, filters);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, dateFrom, dateTo, campaignFilter]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-6 text-center">
        <p className="text-red-600 dark:text-red-400 text-sm mb-3">
          ⚠️ Error loading transactions: {error.message}
        </p>
        <button
          onClick={() => mutate()}
          className="px-4 py-2 text-sm rounded-lg bg-white dark:bg-brand-card border border-slate-200 dark:border-brand-border hover:bg-slate-50 dark:hover:bg-brand-border transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Filters & export toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-purple/50"
          aria-label="Filter by transaction type"
        >
          <option value="all">All Types</option>
          {TRANSACTION_TYPES.slice(1).map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-purple/50"
          aria-label="From date"
        />
        <span className="text-slate-400 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-purple/50"
          aria-label="To date"
        />

        {/* CSV export */}
        <button
          onClick={() => transactions?.length && exportCSV(transactions)}
          disabled={!transactions?.length}
          className="ml-auto touch-target flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-brand-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* ── DataTable ── */}
      <DataTable
        columns={COLUMNS}
        data={transactions ?? []}
        defaultPageSize={PAGE_SIZE}
        emptyState={<RewardsEmptyState />}
        keyField="id"
        urlSync={true}
        queryPrefix="rh_"
        loading={isLoading}
      />
    </div>
  );
}
