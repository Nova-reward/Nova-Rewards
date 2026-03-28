'use client';

import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';
import { useTour } from '../context/TourContext';
import { useTheme } from '../context/ThemeContext';

/**
 * Settings page - user account settings
 * Requirements: 164.2
 */
function SettingsContent() {
  const { startTour } = useTour();
  const { theme, toggleTheme } = useTheme();

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>⚙️ Settings</h2>
          <p style={{ color: 'var(--muted)' }}>
            Manage your account settings and preferences.
          </p>
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Appearance</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9375rem' }}>
            Choose your preferred theme. Your selection will be saved automatically.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9375rem' }}>Theme:</span>
            <button
              className="btn btn-secondary"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </button>
            <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
              Current: {theme === 'light' ? 'Light' : 'Dark'}
            </span>
          </div>
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
