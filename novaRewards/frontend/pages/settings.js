'use client';

import { useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';
import GeneralSettings from '../components/settings/GeneralSettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import PrivacySettings from '../components/settings/PrivacySettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import DataManagement from '../components/settings/DataManagement';

/**
 * Settings page — tabbed layout for user preferences, security, and data.
 * Issue #330
 */

const TABS = [
  { id: 'general', label: '⚙️ General' },
  { id: 'notifications', label: '🔔 Notifications' },
  { id: 'privacy', label: '🔒 Privacy' },
  { id: 'security', label: '🛡️ Security' },
  { id: 'data', label: '📦 Data' },
];

const DEFAULT_PREFS = {
  language: 'en',
  notifications: { email: true, push: false, sms: false },
  privacy: { profileVisibility: 'public', dataSharing: true, activityTracking: true },
  security: { twoFactor: false },
};

function SettingsContent() {
  const [activeTab, setActiveTab] = useState('general');
  const [prefs, setPrefs] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS;
    try {
      const stored = localStorage.getItem('userPrefs');
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const [saved, setSaved] = useState(false);

  const handleChange = useCallback((key, value) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    // TODO: wire to API — PATCH /users/preferences
    localStorage.setItem('userPrefs', JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'general':      return <GeneralSettings prefs={prefs} onChange={handleChange} />;
      case 'notifications': return <NotificationSettings prefs={prefs} onChange={handleChange} />;
      case 'privacy':      return <PrivacySettings prefs={prefs} onChange={handleChange} />;
      case 'security':     return <SecuritySettings prefs={prefs} onChange={handleChange} />;
      case 'data':         return <DataManagement />;
      default:             return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2>⚙️ Settings</h2>
          <p style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
            Manage your preferences, security, and account data.
          </p>
        </div>

        <div className="settings-layout">
          {/* Sidebar nav */}
          <nav className="settings-nav" aria-label="Settings sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`settings-nav-item ${activeTab === tab.id ? 'settings-nav-item-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content panel */}
          <div className="settings-panel card">
            {renderTab()}

            {activeTab !== 'data' && activeTab !== 'security' && (
              <div className="settings-save-row">
                <button className="btn btn-primary" onClick={handleSave}>
                  Save Changes
                </button>
                {saved && <span className="success">✓ Saved successfully</span>}
              </div>
            )}
          </div>
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
