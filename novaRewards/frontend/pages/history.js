'use client';

import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';

/**
 * History page - displays transaction history
 * Requirements: 164.2
 */
function HistoryContent() {
  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>📜 Transaction History</h2>
          <p style={{ color: 'var(--muted)' }}>
            View your complete transaction history. This feature is coming soon!
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

function History() {
  return (
    <ErrorBoundary>
      <HistoryContent />
    </ErrorBoundary>
  );
}

export default withAuth(History);
