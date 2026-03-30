'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ['all', 'pending', 'claimed', 'redeemed'];
const POLL_INTERVAL = 30000; // 30s

function exportCSV(rows) {
  const headers = ['Date', 'Type', 'Amount (NOVA)', 'Status', 'Campaign', 'TX Hash'];
  const lines = rows.map((r) => [
    new Date(r.created_at).toISOString(),
    r.type,
    r.amount,
    r.status,
    r.campaign_name || '',
    r.tx_hash || '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nova-rewards-history-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Rewards history table with pagination, filters, search, CSV export,
 * and real-time balance polling.
 */
export default function RewardsHistory({ userId }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [balance, setBalance] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await api.get(`/users/${userId}/points`);
      setBalance(res.data.data?.balance ?? res.data.balance ?? null);
    } catch {
      // non-fatal
    }
  }, [userId]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      if (status !== 'all') params.status = status;
      if (search) params.search = search;
      const res = await api.get('/rewards/history', { params });
      setRows(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reward history.');
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  // Initial load + re-fetch on filter/page change
  useEffect(() => {
    fetchHistory();
    if (userId) fetchBalance();
  }, [fetchHistory, fetchBalance, userId]);

  // Real-time balance polling
  useEffect(() => {
    if (!userId) return;
    pollRef.current = setInterval(fetchBalance, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchBalance, userId]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const statusBadge = (s) => {
    const map = {
      pending: { bg: '#fef9c3', color: '#854d0e' },
      claimed: { bg: '#dbeafe', color: '#1e40af' },
      redeemed: { bg: '#dcfce7', color: '#15803d' },
    };
    const style = map[s] || { bg: 'var(--surface-2)', color: 'var(--muted)' };
    return (
      <span style={{
        background: style.bg, color: style.color,
        padding: '2px 8px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600,
      }}>
        {s}
      </span>
    );
  };

  return (
    <div>
      {/* Balance card */}
      {balance !== null && (
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Current Balance</p>
            <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>
              {parseFloat(balance).toFixed(2)}
              <span style={{ fontSize: '1rem', fontWeight: 400, marginLeft: '0.4rem', color: 'var(--muted)' }}>NOVA</span>
            </p>
          </div>
          <button
            className="btn btn-secondary"
            style={{ marginLeft: 'auto' }}
            onClick={() => { fetchBalance(); fetchHistory(); }}
          >
            ↻ Refresh
          </button>
        </div>
      )}

      <div className="card">
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
          {/* Search */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
            <input
              className="input"
              style={{ marginBottom: 0, flex: 1 }}
              placeholder="Search by campaign or TX hash…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary">Search</button>
            {search && (
              <button type="button" className="btn btn-secondary" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}>
                Clear
              </button>
            )}
          </form>

          {/* Status filter */}
          <select
            className="input"
            style={{ marginBottom: 0, width: 'auto' }}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          {/* CSV export */}
          <button
            className="btn btn-secondary"
            onClick={() => rows.length && exportCSV(rows)}
            disabled={!rows.length}
            title="Export current page as CSV"
          >
            ⬇ Export CSV
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="error" style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '6px', background: 'rgba(220,38,38,0.1)' }}>
            {error}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p style={{ color: 'var(--muted)', padding: '1rem 0' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--muted)', padding: '1rem 0', textAlign: 'center' }}>No rewards found.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Campaign</th>
                  <th>TX Hash</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>{r.type}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{parseFloat(r.amount).toFixed(4)} NOVA</td>
                    <td>{statusBadge(r.status)}</td>
                    <td>{r.campaign_name || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {r.tx_hash ? (
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${r.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {r.tx_hash.slice(0, 8)}…
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className="btn btn-secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>‹</button>
            <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Page {page} of {totalPages}</span>
            <button className="btn btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>›</button>
            <button className="btn btn-secondary" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
          </div>
        )}
      </div>
    </div>
  );
}
