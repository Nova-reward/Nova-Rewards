'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTransactions } from '../lib/useApi';
import EmptyState from './EmptyState';
import { SkeletonRow } from './Skeleton';

const PAGE_SIZE = 20;
const TRANSACTION_TYPES = ['all', 'issuance', 'redemption', 'transfer'];

/**
 * Cursor-based pagination utilities
 */
const PaginationManager = {
  createCursor: (id, timestamp) => Buffer.from(`${id}:${timestamp}`).toString('base64'),
  decodeCursor: (cursor) => {
    try {
      const [id, timestamp] = Buffer.from(cursor, 'base64').toString().split(':');
      return { id, timestamp };
    } catch {
      return null;
    }
  },
};

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
    ...rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
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
 * Features:
 * - Cursor-based pagination (20 transactions per page)
 * - Filters: type, date range, campaign
 * - CSV export functionality
 * - Stellar Explorer integration
 * - Empty state handling
 */
export default function TransactionHistory({ userId }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [allTransactions, setAllTransactions] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  // Build filter params
  const filters = {
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
    ...(typeFilter !== 'all' && { type: typeFilter }),
    ...(startDate && { dateFrom: startDate }),
    ...(endDate && { dateTo: endDate }),
    ...(campaignFilter !== 'all' && { campaignId: campaignFilter }),
  };

  const { data: transactions, error, isLoading } = useTransactions(userId, filters);

  // Handle filter changes
  const handleFilterReset = useCallback(() => {
    setCurrentPage(0);
  }, []);

  useEffect(() => {
    handleFilterReset();
  }, [typeFilter, startDate, endDate, campaignFilter, handleFilterReset]);

  // Handle CSV export
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      // Fetch all transactions without pagination for export
      const allData = await fetch(
        `/api/transactions?userId=${userId}&limit=10000&type=${typeFilter}${
          startDate ? `&dateFrom=${startDate}` : ''
        }${endDate ? `&dateTo=${endDate}` : ''}${
          campaignFilter !== 'all' ? `&campaignId=${campaignFilter}` : ''
        }`
      ).then(r => r.json());

      if (allData.data) {
        exportToCSV(allData.data);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (error) {
    return (
      <div className="error-container" style={{ padding: '2rem', textAlign: 'center' }}>
        <p className="error-message">Failed to load transactions: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="transaction-history-container" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div className="history-header" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
          Transaction History
        </h2>

        {/* Filter Controls */}
        <div
          className="filter-controls"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
            style={{
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
            }}
          >
            <option value="all">All Types</option>
            {TRANSACTION_TYPES.slice(1).map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="filter-input"
            style={{
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
            }}
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="filter-input"
            style={{
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
            }}
          />

          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="filter-select"
            style={{
              padding: '0.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
            }}
          >
            <option value="all">All Campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="btn btn-primary"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              backgroundColor: '#3b82f6',
              color: '#fff',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.6 : 1,
            }}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Transaction Table */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : transactions && transactions.length > 0 ? (
        <div className="table-wrapper" style={{ overflowX: 'auto', marginBottom: '2rem' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Campaign</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>Explorer</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, idx) => (
                <tr
                  key={tx.id}
                  style={{
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb',
                  }}
                >
                  <td style={{ padding: '1rem' }}>
                    <span
                      className="badge"
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: getBadgeColor(tx.type),
                        color: '#fff',
                      }}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 500 }}>
                    {tx.amount}
                  </td>
                  <td style={{ padding: '1rem' }}>{tx.campaign?.name || 'N/A'}</td>
                  <td style={{ padding: '1rem' }}>
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span
                      className="status-badge"
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: getStatusColor(tx.status),
                        color: '#fff',
                      }}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {tx.txHash ? (
                      <a
                        href={`https://stellar.expert/explorer/public/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#3b82f6',
                          textDecoration: 'none',
                          fontWeight: 500,
                        }}
                      >
                        View
                      </a>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon="transactions"
          title="No transactions yet"
          description="Your transaction history will appear here once you start earning or redeeming rewards."
        />
      )}

      {/* Pagination Controls */}
      {transactions && transactions.length >= PAGE_SIZE && (
        <div
          className="pagination-controls"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            alignItems: 'center',
            marginTop: '2rem',
          }}
        >
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="btn btn-secondary"
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

          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
            Page {currentPage + 1}
          </span>

          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={transactions.length < PAGE_SIZE}
            className="btn btn-secondary"
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
      )}
    </div>
  );
}

/**
 * Helper functions for styling
 */
function getBadgeColor(type) {
  const colors = {
    issuance: '#10b981',
    redemption: '#f59e0b',
    transfer: '#3b82f6',
  };
  return colors[type] || '#6b7280';
}

function getStatusColor(status) {
  const colors = {
    pending: '#f59e0b',
    confirmed: '#10b981',
    failed: '#ef4444',
    completed: '#10b981',
  };
  return colors[status] || '#6b7280';
}
