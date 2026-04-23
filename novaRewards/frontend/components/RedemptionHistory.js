'use client';

import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import MobileCardList from './MobileCardList';

const STATUS_LABEL = {
  pending:   { text: 'Pending',   cls: 'text-yellow-600' },
  completed: { text: 'Completed', cls: 'text-green-600'  },
  failed:    { text: 'Failed',    cls: 'text-red-600'    },
  cancelled: { text: 'Cancelled', cls: 'text-slate-400'  },
};

const COLUMNS = [
  { key: 'reward_name',   label: 'Reward',  render: (v, r) => v || r.rewardName || '—' },
  { key: 'points_spent',  label: 'Points',  render: (v, r) => `−${v ?? r.pointsSpent ?? r.cost ?? '?'}` },
  {
    key: 'status',
    label: 'Status',
    render: (v) => {
      const { text, cls } = STATUS_LABEL[v] || { text: v, cls: 'text-slate-400' };
      return <span className={`font-semibold ${cls}`}>{text}</span>;
    },
  },
  { key: 'created_at', label: 'Date', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
  {
    key: 'tx_hash',
    label: 'Tx',
    render: (v) => v
      ? <a href={`https://stellar.expert/explorer/testnet/tx/${v}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 font-medium" title={v}>{v.slice(0, 8)}…</a>
      : '—',
  },
];

/**
 * Displays paginated redemption history for the authenticated user.
 * Uses MobileCardList for responsive table/card rendering.
 */
export default function RedemptionHistory() {
  const { user } = useAuth();
  const [redemptions, setRedemptions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/redemptions?page=${page}&limit=10`);
        if (cancelled) return;
        const { data, total, limit } = res.data;
        setRedemptions(data || []);
        setTotalPages(Math.max(1, Math.ceil((total || 0) / (limit || 10))));
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user?.id, page]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card p-4 md:p-6 shadow-sm">
      <h2 className="text-base font-bold dark:text-white mb-4">📜 Redemption History</h2>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-100 dark:bg-brand-border animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <>
          <MobileCardList
            columns={COLUMNS}
            data={redemptions}
            emptyMessage="No redemptions yet."
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                className="touch-target px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </button>
              <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
              <button
                className="touch-target px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
