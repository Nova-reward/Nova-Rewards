'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTransactions } from '../lib/useApi';
import EmptyState from './EmptyState';
import LoadingSkeleton from './LoadingSkeleton';

const PAGE_SIZE = 20;
const TRANSACTION_TYPES = ['all', 'issuance', 'redemption', 'transfer'];

/**
 * CSV Export utility
 */
function exportToCSV(transactions) {
  const headers = ['Date', 'Type', 'Amount', 'Campaign', 'Status', 'TX Hash', 'Explorer Link'];
  const rows = transactions.map((tx) => [
    new Date(tx.createdAt).toISOString(),
    tx.type,
    tx.amount,
    tx.campaign?.name || 'N/A',
    tx.status,
    tx.txHash || 'N/A',
    tx.txHash ? `https://stellar.expert/explorer/public/tx/${tx.txHash}` : 'N/A',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `transaction-history-${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Paginated Transaction History Component
 *
 * Features:
 * - Cursor-based pagination (20 transactions per page)
 * - Filters: type, date range, campaign
 * - CSV export of full history
 * - Stellar Explorer link per transaction
 * - Empty state when no transactions exist
 *
 * Closes #592
 */
export default function TransactionHistory({ userId }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [campaigns, setCampaigns] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  const filters = {
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
    ...(typeFilter !== 'all' && { type: typeFilter }),
    ...(startDate && { dateFrom: startDate }),
    ...(endDate && { dateTo: endDate }),
    ...(campaignFilter !== 'all' && { campaignId: campaignFilter }),
  };

  const { data: transactions, error, isLoading } = useTransactions(userId, filters);

  const resetPage = useCallback(() => setCurrentPage(0), []);

  useEffect(() => {
    resetPage();
  }, [typeFilter, startDate, endDate, campaignFilter, resetPage]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        userId,
        limit: 10000,
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(startDate && { dateFrom: startDate }),
        ...(endDate && { dateTo: endDate }),
        ...(campaignFilter !== 'all' && { campaignId: campaignFilter }),
      });
      const res = await fetch(`/api/transactions?${params}`);
      const json = await res.json();
      if (json.data) exportToCSV(json.data);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#ef4444' }}>Failed to load transactions: {error.message}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
          Transaction History
        </h2>

        {/* Filter Controls */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by transaction type"
            style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
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
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Start date"
            style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date"
            style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
          />

          {/* Campaign filter */}
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            aria-label="Filter by campaign"
            style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
          >
            <option value="all">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* CSV Export */}
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.6 : 1,
              fontWeight: 600,
            }}
          >
            {isExporting ? 'Exporting…' : '⬇ Export CSV'}
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : transactions && transactions.length > 0 ? (
        <>
          <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                  {['Type', 'Amount', 'Campaign', 'Date', 'Status', 'Explorer'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '0.75rem 1rem',
                        textAlign: h === 'Amount' ? 'right' : 'left',
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => (
                  <tr
                    key={tx.id || idx}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: TYPE_COLORS[tx.type] || '#6b7280',
                          color: '#fff',
                        }}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 500 }}>
                      {tx.amount}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{tx.campaign?.name || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: STATUS_COLORS[tx.status] || '#6b7280',
                          color: '#fff',
                        }}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      {tx.txHash ? (
                        <a
                          href={`https://stellar.expert/explorer/public/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#3b82f6', fontWeight: 500 }}
                        >
                          View ↗
                        </a>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 0 ? 0.5 : 1,
              }}
            >
              ← Previous
            </button>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Page {currentPage + 1}</span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={transactions.length < PAGE_SIZE}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                cursor: transactions.length < PAGE_SIZE ? 'not-allowed' : 'pointer',
                opacity: transactions.length < PAGE_SIZE ? 0.5 : 1,
              }}
            >
              Next →
            </button>
          </div>
        </>
      ) : (
        <EmptyState
          title="No Transactions"
          message="No transactions found matching your filters."
        />
      )}
    </div>
  );
}

const TYPE_COLORS = {
  issuance: '#10b981',
  redemption: '#f59e0b',
  transfer: '#3b82f6',
};

const STATUS_COLORS = {
  pending: '#f59e0b',
  confirmed: '#10b981',
  completed: '#10b981',
  failed: '#ef4444',
};
