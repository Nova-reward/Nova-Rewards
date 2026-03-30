'use client';

import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import RewardsHistory from '../components/RewardsHistory';
import { withAuth } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';

function HistoryContent() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.4rem', fontWeight: 700 }}>📜 Reward History</h2>
        <RewardsHistory userId={user?.id} />
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
