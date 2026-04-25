'use client';
/**
 * Referral Program Page
 * - Referral link with copy button
 * - Stats: total referrals, pending, confirmed, rewards earned
 * - Referred users list with status badges
 * - Share buttons: Twitter/X, Telegram, WhatsApp
 * - URL param tracking: stores ?ref= in sessionStorage on landing
 *
 * Closes #608
 */

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth } from '../context/AuthContext';
import api from '../lib/api';

// Capture ?ref= param and persist in sessionStorage (runs on every page load)
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) sessionStorage.setItem('referral_code', ref);
}

const STATUS_COLORS = {
  pending:   { bg: 'rgba(234,179,8,0.15)',   color: '#eab308' },
  qualified: { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  rewarded:  { bg: 'rgba(16,185,129,0.15)',  color: '#10b981' },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 10px', borderRadius: '1rem',
      fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

function ReferralPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        // Try to get user id from auth context / localStorage
        const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        const user = stored ? JSON.parse(stored) : null;
        const userId = user?.id;

        if (!userId) throw new Error('not_authenticated');

        const [statsRes, referralsRes] = await Promise.all([
          api.get(`/api/users/${userId}/referral`),
          api.get(`/api/users/${userId}/referrals`),
        ]);

        const code = statsRes.data?.data?.code || statsRes.data?.data?.wallet_address?.slice(-8).toUpperCase() || 'NOVA-REF';
        const referredUsers = referralsRes.data?.data?.referredUsers || [];
        const totalPoints = referralsRes.data?.data?.totalPoints || 0;
        const total = referralsRes.data?.data?.totalReferrals || referredUsers.length;

        const pending   = referredUsers.filter(u => u.status === 'pending').length;
        const confirmed = referredUsers.filter(u => u.status === 'qualified' || u.status === 'rewarded').length;

        setData({ code, referredUsers, totalPoints, total, pending, confirmed });
      } catch {
        // Graceful fallback for demo / missing endpoint
        setData({
          code: 'NOVA-DEMO',
          referredUsers: [],
          totalPoints: 0,
          total: 0,
          pending: 0,
          confirmed: 0,
        });
        setError('Could not load live referral data — showing demo state.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const shareUrl = typeof window !== 'undefined' && data
    ? `${window.location.origin}/register?ref=${data.code}`
    : '';

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const el = document.createElement('input');
        el.value = shareUrl;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const shareLinks = shareUrl ? {
    twitter:  `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Join me on Nova Rewards and earn tokenized loyalty rewards! 🚀')}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Join Nova Rewards!')}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`Join me on Nova Rewards! ${shareUrl}`)}`,
  } : {};

  if (loading) {
    return (
      <DashboardLayout>
        <div className="dashboard-content">
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            Loading referral program…
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.6rem', fontWeight: 700 }}>
          👥 Referral Program
        </h1>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Referrals', value: data.total },
            { label: 'Pending',         value: data.pending },
            { label: 'Confirmed',       value: data.confirmed },
            { label: 'Rewards Earned',  value: `${data.totalPoints} NOVA` },
          ].map(({ label, value }) => (
            <div key={label} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
              <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>{label}</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Referral link */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Your Referral Link</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              readOnly
              value={shareUrl}
              onClick={e => e.target.select()}
              style={{
                flex: 1, minWidth: '200px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '0.5rem',
                padding: '0.6rem 0.8rem',
                color: 'var(--text)',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
              }}
            />
            <button
              className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
              onClick={handleCopy}
              style={{ whiteSpace: 'nowrap' }}
            >
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* Social share buttons */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Share</h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a
              href={shareLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
            >
              𝕏 Twitter / X
            </a>
            <a
              href={shareLinks.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
            >
              ✈️ Telegram
            </a>
            <a
              href={shareLinks.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
            >
              💬 WhatsApp
            </a>
          </div>
        </div>

        {/* Referred users list */}
        <div className="card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Referred Users</h2>
          {data.referredUsers.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              No referrals yet. Share your link to start earning!
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Wallet', 'Joined', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.referredUsers.map((u, i) => (
                    <tr key={u.id ?? i} style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                      <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {u.wallet_address
                          ? `${u.wallet_address.slice(0, 6)}…${u.wallet_address.slice(-4)}`
                          : '—'}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)' }}>
                        {u.referred_at ? new Date(u.referred_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <StatusBadge status={u.status || 'pending'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && (
          <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>{error}</p>
        )}
      </div>
    </DashboardLayout>
  );
}

function Referral() {
  return (
    <ErrorBoundary>
      <ReferralPage />
    </ErrorBoundary>
  );
}

export default withAuth(Referral);
