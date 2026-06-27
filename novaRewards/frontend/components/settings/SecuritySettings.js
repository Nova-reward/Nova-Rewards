'use client';

import { useState } from 'react';
import SettingsToggle from './SettingsToggle';

const MOCK_API_KEYS = [
  { id: 'key_1', name: 'Production Key', prefix: 'nv_live_', created: '2025-01-15', lastUsed: '2026-03-28' },
  { id: 'key_2', name: 'Test Key', prefix: 'nv_test_', created: '2025-06-01', lastUsed: '2026-03-20' },
];

/**
 * Security settings: password change, 2FA toggle, API key management.
 */
export default function SecuritySettings({ prefs, onChange }) {
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [apiKeys, setApiKeys] = useState(MOCK_API_KEYS);
  const [copiedId, setCopiedId] = useState(null);
  const [showRevoke, setShowRevoke] = useState(null);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (passwordForm.next.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    // TODO: wire to API — POST /users/change-password
    setPasswordMsg({ type: 'success', text: 'Password updated successfully.' });
    setPasswordForm({ current: '', next: '', confirm: '' });
  };

  const handleCopyKey = (key) => {
    const fullKey = `${key.prefix}••••••••••••`;
    navigator.clipboard.writeText(fullKey).catch(() => {});
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevokeKey = (keyId) => {
    // TODO: wire to API — DELETE /api-keys/:id
    setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
    setShowRevoke(null);
  };

  return (
    <div>
      <h3 className="settings-section-title">Security</h3>

      {/* Change Password */}
      <div className="settings-subsection">
        <h4 className="settings-subsection-title">Change Password</h4>
        <form onSubmit={handlePasswordSubmit} className="settings-form">
          <div>
            <label className="label" htmlFor="current-password">Current Password</label>
            <input
              id="current-password"
              type="password"
              className="input"
              placeholder="Enter current password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label" htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              className="input"
              placeholder="At least 8 characters"
              value={passwordForm.next}
              onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">Confirm New Password</label>
            <input
              id="confirm-password"
              type="password"
              className="input"
              placeholder="Repeat new password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
              required
              autoComplete="new-password"
            />
          </div>
          {passwordMsg && (
            <p className={passwordMsg.type === 'error' ? 'error' : 'success'}>
              {passwordMsg.text}
            </p>
          )}
          <button type="submit" className="btn btn-primary">Update Password</button>
        </form>
      </div>

      {/* 2FA */}
      <div className="settings-subsection">
        <div className="settings-row">
          <div className="settings-row-info">
            <h4 className="settings-subsection-title" style={{ marginBottom: 0 }}>
              Two-Factor Authentication
            </h4>
            <span className="settings-row-desc">
              Add an extra layer of security to your account
            </span>
          </div>
          <SettingsToggle
            id="security-2fa"
            checked={prefs.security.twoFactor}
            onChange={(val) => onChange('security', { ...prefs.security, twoFactor: val })}
          />
        </div>
        {prefs.security.twoFactor && (
          <p className="settings-row-desc" style={{ marginTop: '0.5rem', color: 'var(--success)' }}>
            ✓ Two-factor authentication is enabled
          </p>
        )}
      </div>

      {/* API Keys */}
      <div className="settings-subsection">
        <h4 className="settings-subsection-title">API Keys</h4>
        <p className="settings-row-desc" style={{ marginBottom: '1rem' }}>
          Manage API keys for programmatic access. Never share your keys publicly.
        </p>
        {apiKeys.length === 0 ? (
          <p className="settings-row-desc">No active API keys.</p>
        ) : (
          <div className="api-keys-list">
            {apiKeys.map((key) => (
              <div key={key.id} className="api-key-row">
                <div className="api-key-info">
                  <span className="api-key-name">{key.name}</span>
                  <code className="api-key-value">{key.prefix}••••••••••••</code>
                  <span className="api-key-meta">
                    Created {key.created} · Last used {key.lastUsed}
                  </span>
                </div>
                <div className="api-key-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleCopyKey(key)}
                    aria-label={`Copy ${key.name}`}
                  >
                    {copiedId === key.id ? '✓ Copied' : '📋 Copy'}
                  </button>
                  {showRevoke === key.id ? (
                    <div className="api-key-confirm">
                      <span className="settings-row-desc">Revoke this key?</span>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleRevokeKey(key.id)}
                      >
                        Confirm
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setShowRevoke(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-danger"
                      onClick={() => setShowRevoke(key.id)}
                      aria-label={`Revoke ${key.name}`}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
