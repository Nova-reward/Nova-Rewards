'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';

const POLL_INTERVAL = 15000;

/**
 * Real-time campaign analytics dashboard with participant list.
 */
export default function CampaignAnalytics({ merchantId, apiKey }) {
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [partSearch, setPartSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const loadCampaigns = useCallback(async () => {
    if (!merchantId) return;
    try {
      const res = await api.get(`/api/campaigns/${merchantId}`);
      const list = res.data.data || [];
      setCampaigns(list);
      if (!selected && list.length) setSelected(list[0].id);
    } catch {
      // ignore
    }
  }, [merchantId, selected]);

  const loadAnalytics = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const [analyticsRes, participantsRes] = await Promise.allSettled([
        api.get(`/api/campaigns/${selected}/analytics`, { headers: { 'x-api-key': apiKey } }),
        api.get(`/api/campaigns/${selected}/participants`, { headers: { 'x-api-key': apiKey } }),
      ]);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data.data || analyticsRes.value.data);
      if (participantsRes.status === 'fulfilled') setParticipants(participantsRes.value.data.data || []);
    } catch (err) {
      setError('Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [selected, apiKey]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);
  useEffect(() => {
    loadAnalytics();
    clearInterval(pollRef.current);
    pollRef.current = setInterval(loadAnalytics, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [loadAnalytics]);

  const filteredParticipants = participants.filter((p) =>
    !partSearch || (p.wallet_address || p.email || '').toLowerCase().includes(partSearch.toLowerCase())
  );

  const Metric = ({ label, value, sub }) => (
    <div className="card" style={{ textAlign: 'center', flex: 1, minWidth: '120px' }}>
      <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>{label}</p>
      <p style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent)' }}>{value ?? '—'}</p>
      {sub && <p style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{sub}</p>}
    </div>
  );

  return (
    <div>
      {/* Campaign selector */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="label" style={{ marginBottom: 0 }}>Campaign:</label>
        <select
          className="input"
          style={{ marginBottom: 0, width: 'auto', minWidth: '200px' }}
          value={selected || ''}
          onChange={(e) => setSelected(e.target.value)}
        >
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={loadAnalytics} disabled={loading}>
          {loading ? '…' : '↻ Refresh'}
        </button>
        <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Auto-refreshes every 15s</span>
      </div>

      {error && (
        <div className="error" style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '6px', background: 'rgba(220,38,38,0.1)' }}>
          {error}
        </div>
      )}

      {/* Metrics */}
      {analytics && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <Metric label="Total Distributed" value={analytics.totalDistributed != null ? `${parseFloat(analytics.totalDistributed).toFixed(2)} NOVA` : null} />
          <Metric label="Total Redeemed" value={analytics.totalRedeemed != null ? `${parseFloat(analytics.totalRedeemed).toFixed(2)} NOVA` : null} />
          <Metric label="Participants" value={analytics.participantCount ?? participants.length} />
          <Metric label="Transactions" value={analytics.transactionCount} />
          <Metric label="Redemption Rate" value={analytics.redemptionRate != null ? `${parseFloat(analytics.redemptionRate).toFixed(1)}%` : null} />
        </div>
      )}

      {/* Performance bar */}
      {analytics?.totalDistributed > 0 && analytics?.totalRedeemed != null && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Redemption Progress</p>
          <div style={{ background: 'var(--surface-2)', borderRadius: '9999px', height: '12px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (analytics.totalRedeemed / analytics.totalDistributed) * 100).toFixed(1)}%`,
              background: 'var(--accent)',
              borderRadius: '9999px',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.4rem' }}>
            {parseFloat(analytics.totalRedeemed).toFixed(2)} / {parseFloat(analytics.totalDistributed).toFixed(2)} NOVA redeemed
          </p>
        </div>
      )}

      {/* Participant list */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontWeight: 700 }}>Participants ({filteredParticipants.length})</h3>
          <input
            className="input"
            style={{ marginBottom: 0, width: '220px' }}
            placeholder="Filter by wallet or email…"
            value={partSearch}
            onChange={(e) => setPartSearch(e.target.value)}
          />
        </div>

        {filteredParticipants.length === 0 ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '1rem 0' }}>No participants yet.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Wallet / Email</th>
                  <th>Earned (NOVA)</th>
                  <th>Redeemed (NOVA)</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((p, i) => (
                  <tr key={p.id || i}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {p.wallet_address ? `${p.wallet_address.slice(0, 8)}…${p.wallet_address.slice(-4)}` : p.email || '—'}
                    </td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{parseFloat(p.earned || 0).toFixed(4)}</td>
                    <td>{parseFloat(p.redeemed || 0).toFixed(4)}</td>
                    <td>{p.joined_at ? new Date(p.joined_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
