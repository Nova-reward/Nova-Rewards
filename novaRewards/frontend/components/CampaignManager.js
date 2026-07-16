'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import CampaignForm from './CampaignForm';
import DataTable from './DataTable';
import EmptyState from './EmptyState';

const STATUS_OPTIONS = ['active', 'paused', 'completed'];

function StatusBadge({ status }) {
  const map = {
    active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    paused:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    completed: 'bg-slate-100 text-slate-500 dark:bg-brand-border dark:text-slate-400',
  };
  const cls = map[status] ?? map.completed;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

/**
 * Campaign management panel: list, create (multi-step), edit, pause.
 * Uses the shared DataTable for consistent sorting, pagination, and URL sync.
 */
export default function CampaignManager({ merchantId, apiKey, onUpdate }) {
  const [campaigns,    setCampaigns]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [view,         setView]         = useState('list'); // 'list' | 'create' | 'edit'
  const [editTarget,   setEditTarget]   = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search,       setSearch]       = useState('');
  const [actionId,     setActionId]     = useState(null);
  const [message,      setMessage]      = useState({ text: '', type: '' });

  const load = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/campaigns/${merchantId}`);
      setCampaigns(res.data.data || []);
    } catch {
      // silently ignore — user can retry via refresh
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

  // Enrich campaigns with a resolved status field for sorting/filtering
  const enriched = campaigns.map((c) => ({ ...c, _status: resolveStatus(c) }));

  const filtered = enriched.filter((c) => {
    if (statusFilter !== 'all' && c._status !== statusFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleFormSuccess = async () => {
    const wasEdit = view === 'edit';
    setView('list');
    setEditTarget(null);
    await load();
    onUpdate?.();
    setMessage({ text: wasEdit ? 'Campaign updated.' : 'Campaign created.', type: 'success' });
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

  const openCreate = () => { setMessage({ text: '', type: '' }); setView('create'); };

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (v) => <span className="font-semibold">{v ?? '—'}</span>,
    },
    {
      key: 'reward_rate',
      label: 'Rate',
      render: (v) => (v != null ? `${v} NOVA/unit` : '—'),
    },
    {
      key: 'start_date',
      label: 'Start',
      render: (v) => v?.slice(0, 10) ?? '—',
    },
    {
      key: 'end_date',
      label: 'End',
      render: (v) => v?.slice(0, 10) ?? '—',
    },
    {
      key: '_status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'id',
      label: 'Actions',
      sortable: false,
      render: (id, row) => (
        <div className="flex items-center gap-2">
          <button
            className="touch-target px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-brand-border bg-white dark:bg-brand-card hover:bg-slate-50 dark:hover:bg-brand-border transition-colors"
            onClick={() => { setEditTarget(row); setView('edit'); setMessage({ text: '', type: '' }); }}
          >
            Edit
          </button>
          {row._status === 'active' && (
            <button
              className="touch-target px-3 py-1 text-xs rounded-lg border border-yellow-300 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors disabled:opacity-40"
              onClick={() => handlePause(row)}
              disabled={actionId === id}
              aria-label={`Pause campaign ${row.name}`}
            >
              {actionId === id ? '…' : 'Pause'}
            </button>
          )}
        </div>
      ),
    },
  ];

  // ── Empty state ─────────────────────────────────────────────────────────
  const emptyState = campaigns.length === 0 ? (
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
  );

  // ── Create / Edit view ──────────────────────────────────────────────────
  if (view === 'create' || view === 'edit') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            className="btn btn-secondary"
            onClick={() => { setView('list'); setEditTarget(null); }}
          >
            ← Back
          </button>
          <h3 className="font-bold text-base">
            {view === 'edit' ? 'Edit Campaign' : 'New Campaign'}
          </h3>
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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input flex-1 min-w-[160px] mb-0"
          style={{ marginBottom: 0 }}
          placeholder="Search campaigns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search campaigns"
        />
        <select
          className="input w-auto mb-0"
          style={{ marginBottom: 0 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={openCreate}>
          + New Campaign
        </button>
      </div>

      {/* Status message */}
      {message.text && (
        <p className={message.type === 'error' ? 'error' : 'success'}>
          {message.text}
        </p>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filtered}
        defaultPageSize={10}
        emptyState={emptyState}
        keyField="id"
        urlSync={true}
        queryPrefix="cm_"
        loading={loading}
      />
    </div>
  );
}
