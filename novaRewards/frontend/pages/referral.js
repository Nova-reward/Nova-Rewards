'use client';

import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import ReferralLink from '../components/ReferralLink';
import { withAuth } from '../context/AuthContext';
import { isEnabled, FLAGS } from '../lib/featureFlags';

/**
 * Referral page - displays referral program information.
 * Gated behind NEXT_PUBLIC_REFERRAL_ENABLED feature flag.
 * Requirements: 164.2, #606
 */
function ReferralContent() {
  // ReferralLink already renders null when the flag is off, but we also
  // show a friendly placeholder so the page isn't completely empty.
  const referralEnabled = isEnabled(FLAGS.REFERRAL);

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        {referralEnabled ? (
          <ReferralLink userId={null} />
        ) : (
          <div className="card">
            <h2 style={{ marginBottom: '1rem' }}>👥 Referral Program</h2>
            <p style={{ color: 'var(--muted)' }}>
              Invite friends and earn rewards. This feature is coming soon!
            </p>
          </div>
        )}
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
