'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import CampaignForm from './CampaignForm';

const STATUS_OPTIONS = ['active', 'paused', 'completed'];

/**
 * Campaign management panel: list, create (multi-step), edit, pause, delete.
 */
export default function CampaignManager({ merchantId, apiKey, onUpdate }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState(null); // id being paused/deleted
  const [message, setMessage] = useState({ text: '', type: '' });

  const load = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/campaigns/${merchantId}`);
      setCampaigns(res.data.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => { load(); }, [load]);

  const resolveStatus = (c) => {
    const now = new Date();
    if (new Date(c.end_date) < now) return 'completed';
    if (!c.is_active) return 'paused';
    return 'active';
  };

  const filtered = campaigns.filter((c) => {
    const s = resolveStatus(c);
    if (statusFilter !== 'all' && s !== statusFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleFormSuccess = async () => {
    setView('list');
    setEditTarget(null);
    await load();
    onUpdate?.();
    setMessage({ text: view === 'edit' ? 'Campaign updated.' : 'Campaign created.', type: 'success' });
  };

  const handlePause = async (c) => {
    if (!confirm(`Pause campaign "${c.name}"?`)) return;
    setActionId(c.id);
    try {
      await api.delete(`/api/campaigns/${c.id}`, { headers: { 'x-api-key': apiKey } });
      await load();
      onUpdate?.();
      setMessage({ text: 'Campaign paused.', type: 'success' });
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Pause failed.', type: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const statusBadge = (s) => {
    const map = {
      active:    { bg: '#dcfce7', color: '#15803d' },
      paused:    { bg: '#fef9c3', color: '#854d0e' },
      completed: { bg: 'var(--surface-2)', color: 'var(--muted)' },
    };
    const style = map[s] || map.completed;
    return (
      <span style={{ background: style.bg, color: style.color, padding: '2px 8px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 }}>
        {s}
      </span>
    );
  };

  // ── Create / Edit view ──────────────────────────────────────────────────
  if (view === 'create' || view === 'edit') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={() => { setView('list'); setEditTarget(null); }}>
            ← Back
          </button>
          <h3 style={{ fontWeight: 700 }}>{view === 'edit' ? 'Edit Campaign' : 'New Campaign'}</h3>
        </div>
        <CampaignForm
          merchantId={merchantId}
          apiKey={apiKey}
          editData={editTarget}
          onSuccess={handleFormSuccess}
        />
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          className="input"
          style={{ marginBottom: 0, flex: 1, minWidth: '160px' }}
          placeholder="Search campaigns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search campaigns"
        />
        <select
          className="input"
          style={{ marginBottom: 0, width: 'auto' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => { setMessage({ text: '', type: '' }); setView('create'); }}>
          + New Campaign
        </button>
      </div>

      {message.text && (
        <p className={message.type === 'error' ? 'error' : 'success'} style={{ marginBottom: '0.75rem' }}>
          {message.text}
        </p>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        campaigns.length === 0 ? (
          <EmptyState
            icon="campaigns"
            title="No campaigns yet"
            description="Create your first campaign to start issuing NOVA rewards to customers."
            actionLabel="+ New Campaign"
            onAction={openCreate}
            variant="primary"
          />
        ) : (
          <EmptyState
            icon="search"
            title="No matching campaigns"
            description="Try adjusting your search or status filter."
          />
        )
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Rate</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const status = resolveStatus(c);
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.reward_rate} NOVA/unit</td>
                    <td>{c.start_date?.slice(0, 10)}</td>
                    <td>{c.end_date?.slice(0, 10)}</td>
                    <td>{statusBadge(status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={() => { setEditTarget(c); setView('edit'); setMessage({ text: '', type: '' }); }}
                        >
                          Edit
                        </button>
                        {status === 'active' && (
                          <button
                            className="btn"
                            style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(234,179,8,0.1)', color: '#854d0e' }}
                            onClick={() => handlePause(c)}
                            disabled={actionId === c.id}
                            aria-label={`Pause campaign ${c.name}`}
                          >
                            {actionId === c.id ? '…' : 'Pause'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
