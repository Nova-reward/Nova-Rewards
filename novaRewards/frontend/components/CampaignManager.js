'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const STATUS_OPTIONS = ['active', 'paused', 'completed'];

function validate(form) {
  const errors = [];
  if (!form.name.trim()) errors.push('Campaign name is required.');
  if (!form.rewardRate || isNaN(Number(form.rewardRate)) || Number(form.rewardRate) <= 0)
    errors.push('Reward rate must be a positive number.');
  if (!form.startDate || !form.endDate) errors.push('Start and end dates are required.');
  else if (new Date(form.endDate) <= new Date(form.startDate))
    errors.push('End date must be after start date.');
  return errors;
}

const EMPTY_FORM = { name: '', rewardRate: '', startDate: '', endDate: '', status: 'active' };

/**
 * Campaign management panel: create, edit, delete, status tracking.
 */
export default function CampaignManager({ merchantId, apiKey, onUpdate }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

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

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setMessage({ text: '', type: '' });
    setShowForm(true);
  };

  const openEdit = (c) => {
    setForm({
      name: c.name,
      rewardRate: c.reward_rate,
      startDate: c.start_date?.slice(0, 10) || '',
      endDate: c.end_date?.slice(0, 10) || '',
      status: resolveStatus(c),
    });
    setEditingId(c.id);
    setMessage({ text: '', type: '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate(form);
    if (errors.length) { setMessage({ text: errors.join(' '), type: 'error' }); return; }

    setSubmitting(true);
    setMessage({ text: '', type: '' });
    try {
      const payload = {
        merchantId,
        name: form.name.trim(),
        rewardRate: form.rewardRate,
        startDate: form.startDate,
        endDate: form.endDate,
        isActive: form.status === 'active',
      };
      if (editingId) {
        await api.put(`/api/campaigns/${editingId}`, payload, { headers: { 'x-api-key': apiKey } });
        setMessage({ text: 'Campaign updated.', type: 'success' });
      } else {
        await api.post('/api/campaigns', payload, { headers: { 'x-api-key': apiKey } });
        setMessage({ text: 'Campaign created.', type: 'success' });
      }
      await load();
      onUpdate?.();
      setShowForm(false);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/campaigns/${id}`, { headers: { 'x-api-key': apiKey } });
      await load();
      onUpdate?.();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

  const statusBadge = (s) => {
    const map = {
      active: { bg: '#dcfce7', color: '#15803d' },
      paused: { bg: '#fef9c3', color: '#854d0e' },
      completed: { bg: 'var(--surface-2)', color: 'var(--muted)' },
    };
    const style = map[s] || map.completed;
    return (
      <span style={{ background: style.bg, color: style.color, padding: '2px 8px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 }}>
        {s}
      </span>
    );
  };

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
        />
        <select className="input" style={{ marginBottom: 0, width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button className="btn btn-primary" onClick={openCreate}>+ New Campaign</button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700 }}>{editingId ? 'Edit Campaign' : 'New Campaign'}</h3>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>✕</button>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="label">Campaign Name</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Summer Rewards" disabled={submitting} />

            <label className="label">Reward Rate (NOVA per unit)</label>
            <input className="input" type="number" min="0.0000001" step="any" value={form.rewardRate} onChange={set('rewardRate')} placeholder="1.5" disabled={submitting} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="label">Start Date</label>
                <input className="input" type="date" value={form.startDate} onChange={set('startDate')} disabled={submitting} />
              </div>
              <div>
                <label className="label">End Date</label>
                <input className="input" type="date" value={form.endDate} onChange={set('endDate')} disabled={submitting} />
              </div>
            </div>

            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')} disabled={submitting}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : editingId ? 'Update Campaign' : 'Create Campaign'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>

            {message.text && (
              <p className={message.type === 'error' ? 'error' : 'success'} style={{ marginTop: '0.75rem' }}>
                {message.text}
              </p>
            )}
          </form>
        </div>
      )}

      {/* Campaign list */}
      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading campaigns…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '1rem 0' }}>
          {campaigns.length === 0 ? 'No campaigns yet. Create one above.' : 'No campaigns match your filters.'}
        </p>
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
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.reward_rate} NOVA/unit</td>
                  <td>{c.start_date?.slice(0, 10)}</td>
                  <td>{c.end_date?.slice(0, 10)}</td>
                  <td>{statusBadge(resolveStatus(c))}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => openEdit(c)}>
                        Edit
                      </button>
                      <button
                        className="btn"
                        style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(220,38,38,0.1)', color: 'var(--error)' }}
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                      >
                        {deletingId === c.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
