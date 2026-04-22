'use client';

import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

const STATUS_LABEL = {
  pending:   { text: 'Pending',   cls: 'badge-yellow' },
  completed: { text: 'Completed', cls: 'badge-green'  },
  failed:    { text: 'Failed',    cls: 'badge-red'    },
  cancelled: { text: 'Cancelled', cls: 'badge-gray'   },
};

/**
 * Displays paginated redemption history for the authenticated user.
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

  if (loading) {
    return (
      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>📜 Redemption History</h2>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>📜 Redemption History</h2>
        <p className="error">{error}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1rem' }}>📜 Redemption History</h2>

      {redemptions.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No redemptions yet.</p>
      ) : (
        <>
          <div className="redemption-history-table" role="table" aria-label="Redemption history">
            <div className="rh-header" role="row">
              <span role="columnheader">Reward</span>
              <span role="columnheader">Points</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Date</span>
              <span role="columnheader">Tx</span>
            </div>

            {redemptions.map((r) => {
              const { text, cls } = STATUS_LABEL[r.status] || { text: r.status, cls: 'badge-gray' };
              return (
                <div key={r.id} className="rh-row" role="row">
                  <span role="cell" className="rh-reward-name">{r.reward_name || r.rewardName || '—'}</span>
                  <span role="cell" className="rh-points">−{r.points_spent ?? r.pointsSpent ?? r.cost ?? '?'}</span>
                  <span role="cell">
                    <span className={`badge ${cls}`}>{text}</span>
                  </span>
                  <span role="cell" className="rh-date">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                  </span>
                  <span role="cell">
                    {r.tx_hash ? (
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${r.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tx-hash-link"
                        title={r.tx_hash}
                      >
                        {r.tx_hash.slice(0, 8)}…
                      </a>
                    ) : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </button>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <button
                className="btn btn-secondary"
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
