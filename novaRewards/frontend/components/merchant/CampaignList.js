'use client';

import Link from 'next/link';
import EmptyState from '../EmptyState';
import DataTable from '../DataTable';

const STATUS_BADGE = {
  active:   { cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: '● Active' },
  paused:   { cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: '⏸ Paused' },
  inactive: { cls: 'bg-slate-100 text-slate-500 dark:bg-brand-border dark:text-slate-400', label: 'Inactive' },
};

function StatusBadge({ status }) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.inactive;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

/** Custom empty state for the campaign list */
function CampaignEmptyState() {
  return (
    <EmptyState
      icon="campaigns"
      title="No campaigns yet"
      description="Create your first reward campaign to get started issuing tokens to your users."
      actionLabel="Create Campaign"
      onAction={() => { window.location.href = '/merchant'; }}
      variant="primary"
    />
  );
}

/**
 * CampaignList — displays merchant campaigns in a shared DataTable.
 * Supports sortable columns, pagination, and URL query string sync.
 *
 * @param {{ campaigns: object[], loading: boolean, onPause: (id:string)=>void, onResume: (id:string)=>void }} props
 */
export default function CampaignList({ campaigns, loading, onPause, onResume }) {
  const columns = [
    {
      key: 'name',
      label: 'Campaign',
      render: (v) => <span className="font-semibold">{v ?? '—'}</span>,
    },
    {
      key: 'rewardRate',
      label: 'Rate',
      render: (v) => (v != null ? `${v} NOVA/unit` : '—'),
    },
    {
      key: 'endDate',
      label: 'Ends',
      render: (v) => (
        <span className="text-slate-500 dark:text-slate-400 text-xs">
          {v ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'id',
      label: 'Actions',
      sortable: false,
      render: (id, row) => (
        <div className="flex items-center gap-2 justify-end whitespace-nowrap">
          {row.status === 'active' && (
            <button
              className="touch-target px-3 py-1 text-xs rounded-lg border border-yellow-300 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
              onClick={() => onPause(id)}
              aria-label={`Pause ${row.name}`}
            >
              Pause
            </button>
          )}
          {row.status === 'paused' && (
            <button
              className="touch-target px-3 py-1 text-xs rounded-lg bg-brand-purple text-white hover:opacity-90 transition-opacity"
              onClick={() => onResume(id)}
              aria-label={`Resume ${row.name}`}
            >
              Resume
            </button>
          )}
          <Link
            href="/merchant"
            className="text-xs text-brand-purple hover:underline"
          >
            Manage →
          </Link>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={campaigns ?? []}
      defaultPageSize={10}
      emptyState={<CampaignEmptyState />}
      keyField="id"
      urlSync={true}
      queryPrefix="cl_"
      loading={loading}
    />
  );
}
