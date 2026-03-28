'use client';

import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';

/**
 * Rewards page - displays available rewards
 * Requirements: 164.2
 */
function RewardsContent() {
  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>🎁 Rewards</h2>
          <p style={{ color: 'var(--muted)' }}>
            Browse and redeem your NOVA rewards. This feature is coming soon!
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Rewards() {
  return (
    <ErrorBoundary>
      <RewardsContent />
    </ErrorBoundary>
  );
}

export default withAuth(Rewards);
