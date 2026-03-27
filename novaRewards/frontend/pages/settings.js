'use client';

import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';

/**
 * Settings page - user account settings
 * Requirements: 164.2
 */
function SettingsContent() {
  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>⚙️ Settings</h2>
          <p style={{ color: 'var(--muted)' }}>
            Manage your account settings. This feature is coming soon!
          </p>
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
