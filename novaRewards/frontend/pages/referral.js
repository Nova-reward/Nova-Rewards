'use client';

import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';

/**
 * Referral page - displays referral program information
 * Requirements: 164.2
 */
function ReferralContent() {
  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>👥 Referral Program</h2>
          <p style={{ color: 'var(--muted)' }}>
            Invite friends and earn rewards. This feature is coming soon!
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Referral() {
  return (
    <ErrorBoundary>
      <ReferralContent />
    </ErrorBoundary>
  );
}

export default withAuth(Referral);
