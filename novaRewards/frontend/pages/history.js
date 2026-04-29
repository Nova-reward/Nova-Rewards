'use client';

import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import TransactionHistory from '../components/TransactionHistory';
import { withAuth } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';

/**
 * Transaction History page — paginated list of all reward issuances,
 * redemptions, and transfers with filtering and CSV export.
 *
 * Closes #592
 */
function HistoryContent() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <TransactionHistory userId={user?.id} />
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
