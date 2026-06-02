'use client';

import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import DataTable from './DataTable';

const STATUS_LABEL = {
  pending:   { text: 'Pending',   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completed: { text: 'Completed', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'   },
  failed:    { text: 'Failed',    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'           },
  cancelled: { text: 'Cancelled', cls: 'bg-slate-100 text-slate-500 dark:bg-brand-border dark:text-slate-400'   },
};

function StatusBadge({ status }) {
  const { text, cls } = STATUS_LABEL[status] ?? { text: status, cls: 'bg-slate-100 text-slate-500' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {text}
    </span>
  );
}

const COLUMNS = [
  {
    key: 'reward_name',
    label: 'Reward',
    render: (v, r) => v || r.rewardName || '—',
  },
  {
    key: 'points_spent',
    label: 'Points',
    render: (v, r) => `−${v ?? r.pointsSpent ?? r.cost ?? '?'}`,
  },
  {
    key: 'status',
    label: 'Status',
    render: (v) => <StatusBadge status={v} />,
  },
  {
    key: 'created_at',
    label: 'Date',
    render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
  },
  {
    key: 'tx_hash',
    label: 'Tx',
    sortable: false,
    render: (v) =>
      v ? (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${v}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 font-medium hover:underline"
          title={v}
        >
          {v.slice(0, 8)}…
        </a>
      ) : (
        '—'
      ),
  },
];

/** Custom empty state for the redemption history table */
function RedemptionEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <span className="text-3xl" aria-hidden="true">🎟️</span>
      <p className="font-medium text-slate-700 dark:text-slate-300">No redemptions yet</p>
      <p className="text-xs text-slate-400">
        Your redemption history will appear here once you redeem rewards.
      </p>
    </div>
  );
}

/**
 * RedemptionHistory — paginated redemption history for the authenticated user.
 * Uses the shared DataTable for consistent sorting, pagination, and URL sync.
 */
export default function RedemptionHistory() {
  const { user } = useAuth();
  const [redemptions, setRedemptions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all redemptions — DataTable handles client-side pagination
        const res = await api.get('/redemptions?limit=200');
        if (cancelled) return;
        setRedemptions(res.data?.data || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 md:p-6 shadow-sm">
      <h2 className="text-base font-bold dark:text-white mb-4">📜 Redemption History</h2>

      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <DataTable
          columns={COLUMNS}
          data={redemptions}
          defaultPageSize={10}
          emptyState={<RedemptionEmptyState />}
          keyField="id"
          urlSync={true}
          queryPrefix="rdh_"
          loading={loading}
        />
      )}
    </div>
  );
}
