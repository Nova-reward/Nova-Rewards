'use client';

import { useCallback, useRef } from 'react';
import { useInfiniteScroll, useSentinel } from '../hooks/useInfiniteScroll';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { transactionAPI } from '../lib/transactionAPI';
import EmptyState from './EmptyState';
import { SkeletonTransactionHistory } from './Skeleton';
import DataTable from './DataTable';

const PAGE_SIZE = 25;

/** Column definitions for the transaction table */
const COLUMNS = [
  {
    key: 'action_type',
    label: 'Type',
    render: (v) => <span className="font-semibold capitalize">{v ?? '—'}</span>,
  },
  {
    key: 'amount',
    label: 'Amount',
    render: (v) => <span className="font-medium">{v ?? '—'}</span>,
  },
  {
    key: 'campaign_name',
    label: 'Campaign',
    render: (v) => v || 'N/A',
  },
  {
    key: 'timestamp',
    label: 'Date',
    render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
  },
  {
    key: 'status',
    label: 'Status',
    render: (v) => <span className="capitalize font-semibold">{v ?? '—'}</span>,
  },
  {
    key: 'tx_hash',
    label: 'Explorer',
    sortable: false,
    render: (v) =>
      v ? (
        <a
          href={`https://stellar.expert/explorer/public/tx/${v}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 font-medium hover:underline"
        >
          View
        </a>
      ) : (
        '—'
      ),
  },
];

/** Custom empty state shown inside the DataTable */
function TxEmptyState() {
  return (
    <EmptyState
      icon="transactions"
      title="No transactions yet"
      description="Your transaction history will appear here once you start earning or redeeming rewards."
    />
  );
}

/**
 * TransactionHistory — infinite scroll with cursor-based pagination.
 * Renders all loaded items in a shared DataTable with sort + URL sync.
 * Closes #842
 */
export default function TransactionHistory({ userId }) {
  useScrollRestoration('history');

  // Cursors indexed by page number so useInfiniteScroll can re-fetch any page
  const cursors = useRef({ 1: undefined });

  const fetchPage = useCallback(
    async (page) => {
      const cursor = cursors.current[page];
      const res = await transactionAPI.getTransactionsCursor(userId, {
        limit: PAGE_SIZE,
        cursor,
      });
      if (res.nextCursor) {
        cursors.current[page + 1] = res.nextCursor;
      }
      return {
        items: res.data ?? [],
        hasMore: !!res.nextCursor,
      };
    },
    [userId]
  );

  const { items, loading, error, hasMore, loadMore, retry } = useInfiniteScroll(fetchPage);

  const sentinelRef = useSentinel(loadMore, {
    enabled: hasMore && !loading && !error,
    rootMargin: '200px',
  });

  if (error && items.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">Failed to load transactions: {error}</p>
        <button
          onClick={retry}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="transaction-history-container" style={{ padding: '1.5rem' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Transaction History
      </h2>

      {/* Initial skeleton */}
      {loading && items.length === 0 && <SkeletonTransactionHistory rows={5} />}

      {/* DataTable — handles sort, pagination, empty state, and URL sync */}
      {(!loading || items.length > 0) && (
        <DataTable
          columns={COLUMNS}
          data={items}
          defaultPageSize={25}
          emptyState={<TxEmptyState />}
          keyField="id"
          urlSync={true}
          queryPrefix="tx_"
          loading={loading && items.length === 0}
        />
      )}

      {/* Sentinel — triggers next page load when scrolled within 200px */}
      <div ref={sentinelRef} aria-hidden="true" />

      {/* Loading spinner for subsequent pages */}
      {loading && items.length > 0 && (
        <div
          role="status"
          aria-label="Loading more transactions"
          className="flex justify-center py-6"
        >
          <svg
            className="animate-spin h-6 w-6 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        </div>
      )}

      {/* Error on subsequent pages */}
      {error && items.length > 0 && (
        <div className="flex justify-center py-4 gap-3 items-center">
          <span className="text-red-500 text-sm">Failed to load more.</span>
          <button
            onClick={retry}
            className="text-sm px-3 py-1 rounded border border-red-400 text-red-500 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* End of list */}
      {!hasMore && !loading && items.length > 0 && (
        <p
          role="status"
          className="text-center text-sm text-gray-500 py-6"
        >
          All transactions loaded
        </p>
      )}
    </div>
  );
}
