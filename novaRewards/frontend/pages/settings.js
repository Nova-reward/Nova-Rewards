'use client';

import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';
import { useTour } from '../context/TourContext';

/**
 * Settings page - user account settings
 * Requirements: 164.2
 */
function SettingsContent() {
  const { startTour } = useTour();

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>⚙️ Settings</h2>
          <p style={{ color: 'var(--muted)' }}>
            Manage your account settings. This feature is coming soon!
          </p>
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Platform Tour</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9375rem' }}>
            Replay the onboarding walkthrough to revisit key platform features.
          </p>
          <button
            className="btn btn-secondary"
            onClick={startTour}
            aria-label="Restart platform onboarding tour"
          >
            🗺️ Restart Tour
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Settings() {
  return (
    <ErrorBoundary>
      <SettingsContent />
    </ErrorBoundary>
  );
}

export default withAuth(Settings);
