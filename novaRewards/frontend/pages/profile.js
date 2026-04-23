'use client';
import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { withAuth, useAuth } from '../context/AuthContext';
import api from '../lib/api';

const NOTIF_EVENTS = [
  { key: 'reward_issued', label: 'Reward Issued' },
  { key: 'redemption_confirmed', label: 'Redemption Confirmed' },
  { key: 'campaign_expiring', label: 'Campaign Expiring' },
];

/** Minimal inline toast — avoids external dependency */
function Toast({ toasts, onDismiss }) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} role="alert">
          <span>{t.message}</span>
          <button className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss">✕</button>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  function add(message, type = 'success') {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }
  function dismiss(id) { setToasts((p) => p.filter((t) => t.id !== id)); }
  return { toasts, add, dismiss };
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button className="btn btn-secondary btn-sm" onClick={copy} aria-label="Copy wallet address">
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function UserProfileContent() {
  const { user } = useAuth();
  const { toasts, add: addToast, dismiss } = useToasts();

  const [form, setForm] = useState({ display_name: '', email: '' });
  const [notifPrefs, setNotifPrefs] = useState({ email: {}, in_app: {} });
  const [stats, setStats] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const fileRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  useEffect(() => {
    if (!user) return;
    setForm({ display_name: user.display_name || user.first_name || '', email: user.email || '' });

    async function loadData() {
      try {
        const [notifRes, statsRes] = await Promise.all([
          api.get(`/api/users/${user.id}/notification-preferences`).catch(() => ({ data: { data: {} } })),
          api.get(`/api/users/${user.id}/stats`).catch(() => ({ data: { data: null } })),
        ]);
        const prefs = notifRes.data?.data || {};
        setNotifPrefs({
          email: prefs.email || {},
          in_app: prefs.in_app || {},
        });
        setStats(statsRes.data?.data || null);
      } catch { /* non-fatal */ }
    }
    loadData();
    setAvatarPreview(user.avatar_url || null);
  }, [user]);

  async function handleProfileSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/users/${user.id}`, {
        display_name: form.display_name,
        email: form.email,
      });
      addToast('Profile updated successfully.', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Update failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleNotifSave() {
    setSavingNotif(true);
    try {
      await api.patch(`/api/users/${user.id}/notification-preferences`, notifPrefs);
      addToast('Notification preferences saved.', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Save failed.', 'error');
    } finally {
      setSavingNotif(false);
    }
  }

  function toggleNotif(channel, event) {
    setNotifPrefs((p) => ({
      ...p,
      [channel]: { ...p[channel], [event]: !p[channel][event] },
    }));
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      addToast('Only JPEG, PNG, or WebP allowed.', 'error'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('File must be 5 MB or smaller.', 'error'); return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    const form = new FormData();
    form.append('avatar', file);
    try {
      await api.post(`/api/users/${user.id}/profile-picture`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast('Avatar updated.', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Upload failed.', 'error');
    }
  }

  const initials = (user?.display_name || user?.first_name || 'U')[0].toUpperCase();

  return (
    <DashboardLayout>
      <Toast toasts={toasts} onDismiss={dismiss} />
      <div className="dashboard-content">

        {/* ── Avatar + Wallet ── */}
        <div className="card profile-header-card">
          <button
            className="avatar-upload-btn"
            onClick={() => fileRef.current?.click()}
            aria-label="Change profile picture"
          >
            {avatarPreview
              ? <img src={avatarPreview} alt="Avatar" className="avatar-preview-img" />
              : <div className="avatar-placeholder">{initials}</div>}
            <div className="avatar-overlay">📷</div>
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }} onChange={handleAvatarChange} />

          <div className="profile-wallet-row">
            <span className="label">Wallet Address</span>
            <code className="wallet-address">{user?.wallet_address || '—'}</code>
            {user?.wallet_address && <CopyButton text={user.wallet_address} />}
          </div>
        </div>

        {/* ── Profile Form ── */}
        <div className="card">
          <h3 className="settings-section-title">Profile</h3>
          <form onSubmit={handleProfileSave}>
            <div className="form-group">
              <label className="form-label" htmlFor="display-name">Display Name</label>
              <input id="display-name" className="form-input" value={form.display_name}
                onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" type="email" className="form-input" value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* ── Notification Preferences ── */}
        <div className="card">
          <h3 className="settings-section-title">Notification Preferences</h3>
          <table className="notif-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Email</th>
                <th>In-App</th>
              </tr>
            </thead>
            <tbody>
              {NOTIF_EVENTS.map(({ key, label }) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td>
                    <input type="checkbox" checked={!!notifPrefs.email[key]}
                      onChange={() => toggleNotif('email', key)}
                      aria-label={`Email notification for ${label}`} />
                  </td>
                  <td>
                    <input type="checkbox" checked={!!notifPrefs.in_app[key]}
                      onChange={() => toggleNotif('in_app', key)}
                      aria-label={`In-app notification for ${label}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }}
            onClick={handleNotifSave} disabled={savingNotif}>
            {savingNotif ? 'Saving…' : 'Save Preferences'}
          </button>
        </div>

        {/* ── Account Stats ── */}
        <div className="card">
          <h3 className="settings-section-title">Account Stats</h3>
          {stats ? (
            <dl className="stats-grid">
              <dt>Total Rewards Earned</dt><dd>{stats.total_earned ?? '—'} NOVA</dd>
              <dt>Total Redeemed</dt><dd>{stats.total_redeemed ?? '—'} NOVA</dd>
              <dt>Member Since</dt>
              <dd>{stats.member_since ? new Date(stats.member_since).toLocaleDateString() : '—'}</dd>
            </dl>
          ) : (
            <p className="muted">Loading stats…</p>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}

export default withAuth(UserProfileContent);
