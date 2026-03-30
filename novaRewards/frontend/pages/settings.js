'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';
import { useTour } from '../context/TourContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
import api from '../lib/api';

const DEFAULT_PREFS = {
  rewards: true,
  redemptions: true,
  campaigns: false,
  referrals: true,
  system: false,
};

function SettingsContent() {
  const { startTour } = useTour();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/notifications/preferences')
      .then((res) => setPrefs((p) => ({ ...p, ...res.data })))
      .catch(() => {});
  }, []);

  const handleToggle = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/notifications/preferences', prefs);
      addToast('Notification preferences saved', 'success');
    } catch {
      addToast('Failed to save preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  const prefLabels = {
    rewards: 'Reward earned',
    redemptions: 'Redemption confirmed',
    campaigns: 'New campaigns',
    referrals: 'Referral activity',
    system: 'System announcements',
  };

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
          <h3 style={{ marginBottom: '0.25rem' }}>📧 Email Notifications</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9375rem' }}>
            Choose which events trigger an email notification.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(prefLabels).map(([key, label]) => (
              <label
                key={key}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9375rem' }}
              >
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={() => handleToggle(key)}
                  style={{ width: '1rem', height: '1rem', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                {label}
              </label>
            ))}
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ marginTop: '1.25rem' }}
          >
            {saving ? 'Saving…' : 'Save Preferences'}
          </button>
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
