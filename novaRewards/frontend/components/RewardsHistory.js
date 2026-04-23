'use client';

import { useState, useEffect } from 'react';
import { useTransactions } from '../lib/useApi';

const PAGE_SIZE = 20;
const TRANSACTION_TYPES = ['all', 'issuance', 'redemption', 'transfer'];

function exportCSV(rows) {
  const headers = ['Date', 'Type', 'Amount', 'Campaign', 'Status', 'TX Hash', 'Explorer Link'];
  const lines = rows.map((r) => [
    new Date(r.createdAt).toISOString(),
    r.type,
    r.amount,
    r.campaign?.name || '',
    r.status,
    r.txHash || '',
    `https://stellar.expert/explorer/public/tx/${r.txHash}`,
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
 * Paginated transaction history with filters and CSV export
 */
export default function RewardsHistory({ userId }) {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');

  const filters = {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    ...(typeFilter !== 'all' && { type: typeFilter }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(campaignFilter !== 'all' && { campaignId: campaignFilter }),
  };

  const { data: transactions, error, isLoading, mutate } = useTransactions(userId, filters);

  const handleExport = () => {
    if (transactions) exportCSV(transactions);
  };

  const handleFilterChange = () => {
    setPage(1); // Reset to first page
    mutate(); // Re-fetch
  };

  useEffect(() => {
    handleFilterChange();
  }, [typeFilter, dateFrom, dateTo, campaignFilter]);

  if (error) {
    return <div className="error">Error loading transactions: {error.message}</div>;
  }

  return (
    <div className="rewards-history">
      {/* Filters */}
      <div className="filters" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          {TRANSACTION_TYPES.slice(1).map(type => (
            <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="To date"
        />
        <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
          <option value="all">All Campaigns</option>
          {/* Assume campaigns are fetched separately or from context */}
        </select>
        <button onClick={handleExport} className="btn btn-secondary">Export CSV</button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div>Loading...</div>
      ) : transactions && transactions.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Campaign</th>
                <th>Date</th>
                <th>Status</th>
                <th>Explorer</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.type}</td>
                  <td>{tx.amount}</td>
                  <td>{tx.campaign?.name || 'N/A'}</td>
                  <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td><span className={`badge ${tx.status}`}>{tx.status}</span></td>
                  <td>
                    {tx.txHash ? (
                      <a href={`https://stellar.expert/explorer/public/tx/${tx.txHash}`} target="_blank" rel="noopener">
                        View
                      </a>
                    ) : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No transactions found.</p>
        </div>
      )}

      {/* Pagination */}
      {transactions && transactions.length >= PAGE_SIZE && (
        <div className="pagination" style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary"
          >
            Previous
          </button>
          <span style={{ margin: '0 1rem' }}>Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="btn btn-secondary"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}import { useState, useEffect, useCallback, useRef } from 'react';
import { useTransactions } from '../lib/useApi';

const PAGE_SIZE = 20;
const TRANSACTION_TYPES = ['all', 'issuance', 'redemption', 'transfer'];

function exportCSV(rows) {
  const headers = ['Date', 'Type', 'Amount', 'Campaign', 'Status', 'TX Hash', 'Explorer Link'];
  const lines = rows.map((r) => [
    new Date(r.createdAt).toISOString(),
    r.type,
    r.amount,
    r.campaign?.name || '',
    r.status,
    r.txHash || '',
    `https://stellar.expert/explorer/public/tx/${r.txHash}`,
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
 * Paginated transaction history with filters and CSV export
 */
export default function RewardsHistory({ userId }) {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');

  const filters = {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    ...(typeFilter !== 'all' && { type: typeFilter }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(campaignFilter !== 'all' && { campaignId: campaignFilter }),
  };

  const { data: transactions, error, isLoading, mutate } = useTransactions(userId, filters);

  const handleExport = () => {
    if (transactions) exportCSV(transactions);
  };

  const handleFilterChange = () => {
    setPage(1); // Reset to first page
    mutate(); // Re-fetch
  };

  useEffect(() => {
    handleFilterChange();
  }, [typeFilter, dateFrom, dateTo, campaignFilter]);

  if (error) {
    return <div className="error">Error loading transactions: {error.message}</div>;
  }

  return (
    <div className="rewards-history">
      {/* Filters */}
      <div className="filters" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          {TRANSACTION_TYPES.slice(1).map(type => (
            <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="To date"
        />
        <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
          <option value="all">All Campaigns</option>
          {/* Assume campaigns are fetched separately or from context */}
        </select>
        <button onClick={handleExport} className="btn btn-secondary">Export CSV</button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div>Loading...</div>
      ) : transactions && transactions.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Campaign</th>
                <th>Date</th>
                <th>Status</th>
                <th>Explorer</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.type}</td>
                  <td>{tx.amount}</td>
                  <td>{tx.campaign?.name || 'N/A'}</td>
                  <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td><span className={`badge ${tx.status}`}>{tx.status}</span></td>
                  <td>
                    {tx.txHash ? (
                      <a href={`https://stellar.expert/explorer/public/tx/${tx.txHash}`} target="_blank" rel="noopener">
                        View
                      </a>
                    ) : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No transactions found.</p>
        </div>
      )}

      {/* Pagination */}
      {transactions && transactions.length >= PAGE_SIZE && (
        <div className="pagination" style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary"
          >
            Previous
          </button>
          <span style={{ margin: '0 1rem' }}>Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="btn btn-secondary"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
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
