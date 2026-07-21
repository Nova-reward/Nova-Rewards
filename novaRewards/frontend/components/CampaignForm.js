'use client';

import { useState } from 'react';
import MultiStepForm from './MultiStepForm';
import api from '../lib/api';

function createTokenRow(id) {
  return {
    id: id ?? `token-row-${Math.random().toString(36).slice(2, 10)}`,
    name: '',
    amount: '',
  };
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  // Step 1 — Basic Info
  {
    title: 'Basic Info',
    validate(data) {
      const errors = {};
      if (!data.name?.trim()) errors.name = 'Campaign name is required.';
      if (!data.description?.trim()) errors.description = 'Description is required.';
      return errors;
    },
    fields(data, update, errors) {
      return (
        <>
          <label className="label" htmlFor="campaign-name">Campaign Name</label>
          <input
            id="campaign-name"
            name="name"
            className="input"
            value={data.name ?? ''}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Summer Rewards 2026"
            aria-describedby={errors.name ? 'name-err' : undefined}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p id="name-err" className="error" role="alert">{errors.name}</p>}

          <label className="label" htmlFor="campaign-description" style={{ marginTop: '1rem' }}>Description</label>
          <textarea
            id="campaign-description"
            name="description"
            className="input"
            rows={3}
            value={data.description ?? ''}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Earn NOVA tokens on every purchase."
            aria-describedby={errors.description ? 'desc-err' : undefined}
            aria-invalid={Boolean(errors.description)}
          />
          {errors.description && <p id="desc-err" className="error" role="alert">{errors.description}</p>}
        </>
      );
    },
  },

  // Step 2 — Token Config
  {
    title: 'Token Config',
    validate(data) {
      const errors = {};
      if (!data.tokenSymbol?.trim()) errors.tokenSymbol = 'Token symbol is required.';
      if (!data.rewardRate || isNaN(Number(data.rewardRate)) || Number(data.rewardRate) <= 0)
        errors.rewardRate = 'Reward rate must be a positive number.';
      return errors;
    },
    fields(data, update, errors) {
      const rows = data.tokenRows ?? [];
      const addRow = () => update('tokenRows', [...rows, createTokenRow()]);
      const updateRow = (rowId, field, value) => {
        update('tokenRows', rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
      };
      const removeRow = (rowId) => {
        const nextRows = rows.filter((row) => row.id !== rowId);
        update('tokenRows', nextRows.length ? nextRows : [createTokenRow()]);
      };

      return (
        <>
          <label className="label" htmlFor="token-symbol">Token Symbol</label>
          <input
            id="token-symbol"
            name="tokenSymbol"
            className="input"
            value={data.tokenSymbol ?? 'NOVA'}
            onChange={(e) => update('tokenSymbol', e.target.value.toUpperCase())}
            placeholder="NOVA"
            maxLength={12}
            aria-describedby={errors.tokenSymbol ? 'sym-err' : undefined}
            aria-invalid={Boolean(errors.tokenSymbol)}
          />
          {errors.tokenSymbol && <p id="sym-err" className="error" role="alert">{errors.tokenSymbol}</p>}

          <label className="label" htmlFor="reward-rate" style={{ marginTop: '1rem' }}>Reward Rate (tokens per unit of spend)</label>
          <input
            id="reward-rate"
            name="rewardRate"
            className="input"
            type="number"
            min="0.0000001"
            step="any"
            value={data.rewardRate ?? ''}
            onChange={(e) => update('rewardRate', e.target.value)}
            placeholder="1.5"
            aria-describedby={errors.rewardRate ? 'rate-err' : undefined}
            aria-invalid={Boolean(errors.rewardRate)}
          />
          {errors.rewardRate && <p id="rate-err" className="error" role="alert">{errors.rewardRate}</p>}

          <div role="group" aria-labelledby="token-row-group-title" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 id="token-row-group-title" className="label" style={{ margin: 0 }}>Token Rows</h4>
              <button type="button" className="btn btn-secondary" onClick={addRow}>
                Add token row
              </button>
            </div>
            {rows.map((row, index) => (
              <div key={row.id} style={{ display: 'grid', gap: '0.75rem', padding: '0.75rem', border: '1px solid var(--border, #e2e8f0)', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="label" htmlFor={`token-row-name-${row.id}`}>Token Row {index + 1}</label>
                  {rows.length > 1 && (
                    <button type="button" className="btn btn-secondary" onClick={() => removeRow(row.id)}>
                      Remove row
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label" htmlFor={`token-row-name-${row.id}`}>Token Name</label>
                    <input
                      id={`token-row-name-${row.id}`}
                      className="input"
                      value={row.name}
                      onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                      placeholder="VIP"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`token-row-amount-${row.id}`}>Amount</label>
                    <input
                      id={`token-row-amount-${row.id}`}
                      className="input"
                      type="number"
                      min="0"
                      step="any"
                      value={row.amount}
                      onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                      placeholder="1000"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      );
    },
  },

  // Step 3 — Rules
  {
    title: 'Rules',
    validate(data) {
      const errors = {};
      if (data.minSpend && (isNaN(Number(data.minSpend)) || Number(data.minSpend) < 0))
        errors.minSpend = 'Minimum spend must be a non-negative number.';
      if (data.maxRewardPerUser && (isNaN(Number(data.maxRewardPerUser)) || Number(data.maxRewardPerUser) <= 0))
        errors.maxRewardPerUser = 'Max reward per user must be a positive number.';
      return errors;
    },
    fields(data, update, errors) {
      return (
        <>
          <label className="label" htmlFor="min-spend">Minimum Spend to Qualify (optional)</label>
          <input
            id="min-spend"
            name="minSpend"
            className="input"
            type="number"
            min="0"
            step="any"
            value={data.minSpend ?? ''}
            onChange={(e) => update('minSpend', e.target.value)}
            placeholder="0"
            aria-describedby={errors.minSpend ? 'min-err' : undefined}
            aria-invalid={Boolean(errors.minSpend)}
          />
          {errors.minSpend && <p id="min-err" className="error" role="alert">{errors.minSpend}</p>}

          <label className="label" htmlFor="max-reward" style={{ marginTop: '1rem' }}>Max Reward Per User (optional)</label>
          <input
            id="max-reward"
            name="maxRewardPerUser"
            className="input"
            type="number"
            min="0"
            step="any"
            value={data.maxRewardPerUser ?? ''}
            onChange={(e) => update('maxRewardPerUser', e.target.value)}
            placeholder="Unlimited"
            aria-describedby={errors.maxRewardPerUser ? 'max-err' : undefined}
            aria-invalid={Boolean(errors.maxRewardPerUser)}
          />
          {errors.maxRewardPerUser && <p id="max-err" className="error" role="alert">{errors.maxRewardPerUser}</p>}

          <label className="label" htmlFor="eligible-action" style={{ marginTop: '1rem' }}>Eligible Actions</label>
          <select
            id="eligible-action"
            name="eligibleAction"
            className="input"
            value={data.eligibleAction ?? 'purchase'}
            onChange={(e) => update('eligibleAction', e.target.value)}
          >
            <option value="purchase">Purchase</option>
            <option value="referral">Referral</option>
            <option value="signup">Sign-up</option>
            <option value="review">Review</option>
          </select>
        </>
      );
    },
  },

  // Step 4 — Budget
  {
    title: 'Budget',
    validate(data) {
      const errors = {};
      if (!data.totalBudget || isNaN(Number(data.totalBudget)) || Number(data.totalBudget) <= 0)
        errors.totalBudget = 'Total budget must be a positive number.';
      if (!data.startDate) errors.startDate = 'Start date is required.';
      if (!data.endDate) errors.endDate = 'End date is required.';
      if (data.startDate && data.endDate && new Date(data.endDate) <= new Date(data.startDate))
        errors.endDate = 'End date must be after start date.';
      return errors;
    },
    fields(data, update, errors) {
      return (
        <>
          <label className="label" htmlFor="total-budget">Total Budget (NOVA tokens)</label>
          <input
            id="total-budget"
            name="totalBudget"
            className="input"
            type="number"
            min="1"
            step="any"
            value={data.totalBudget ?? ''}
            onChange={(e) => update('totalBudget', e.target.value)}
            placeholder="10000"
            aria-describedby={errors.totalBudget ? 'budget-err' : undefined}
            aria-invalid={Boolean(errors.totalBudget)}
          />
          {errors.totalBudget && <p id="budget-err" className="error" role="alert">{errors.totalBudget}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label className="label" htmlFor="start-date">Start Date</label>
              <input
                id="start-date"
                name="startDate"
                className="input"
                type="date"
                value={data.startDate ?? ''}
                onChange={(e) => update('startDate', e.target.value)}
                aria-describedby={errors.startDate ? 'start-err' : undefined}
                aria-invalid={Boolean(errors.startDate)}
              />
              {errors.startDate && <p id="start-err" className="error" role="alert">{errors.startDate}</p>}
            </div>
            <div>
              <label className="label" htmlFor="end-date">End Date</label>
              <input
                id="end-date"
                name="endDate"
                className="input"
                type="date"
                value={data.endDate ?? ''}
                onChange={(e) => update('endDate', e.target.value)}
                aria-describedby={errors.endDate ? 'end-err' : undefined}
                aria-invalid={Boolean(errors.endDate)}
              />
              {errors.endDate && <p id="end-err" className="error" role="alert">{errors.endDate}</p>}
            </div>
          </div>
        </>
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Review summary
// ---------------------------------------------------------------------------

function renderSummary(data) {
  const rows = [
    ['Campaign Name', data.name],
    ['Description', data.description],
    ['Token Symbol', data.tokenSymbol || 'NOVA'],
    ['Reward Rate', `${data.rewardRate} tokens / unit`],
    ['Eligible Action', data.eligibleAction || 'purchase'],
    ['Min Spend', data.minSpend ? `${data.minSpend}` : 'None'],
    ['Max Reward / User', data.maxRewardPerUser ? `${data.maxRewardPerUser}` : 'Unlimited'],
    ['Total Budget', `${data.totalBudget} NOVA`],
    ['Start Date', data.startDate],
    ['End Date', data.endDate],
  ];
  return (
    <dl className="msf-summary-list">
      {rows.map(([label, value]) => (
        <div key={label} className="msf-summary-row">
          <dt>{label}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Transaction confirmation modal
// ---------------------------------------------------------------------------

function TxConfirmModal({ data, onConfirm, onCancel, submitting }) {
  const estimatedFee = '0.00001 XLM'; // Soroban base fee estimate
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div className="card" style={{ maxWidth: 420, width: '90%' }}>
        <h3 id="tx-modal-title" style={{ fontWeight: 700, marginBottom: '0.75rem' }}>
          Confirm On-Chain Transaction
        </h3>
        <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          This will register <strong>{data.name}</strong> on the Stellar network.
        </p>
        <dl className="msf-summary-list" style={{ marginBottom: '1rem' }}>
          <div className="msf-summary-row"><dt>Estimated Fee</dt><dd>{estimatedFee}</dd></div>
          <div className="msf-summary-row"><dt>Network</dt><dd>{process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'TESTNET'}</dd></div>
        </dl>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Signing…' : 'Sign & Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CampaignForm — main export
// ---------------------------------------------------------------------------

const INITIAL_DATA = {
  name: '', description: '', tokenSymbol: 'NOVA', rewardRate: '',
  eligibleAction: 'purchase', minSpend: '', maxRewardPerUser: '',
  totalBudget: '', startDate: '', endDate: '', tokenRows: [],
};

export default function CampaignForm({ merchantId, apiKey, onSuccess, editData }) {
  const [pendingData, setPendingData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleReviewSubmit(data) {
    setPendingData(data);
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const payload = {
        merchantId,
        name: pendingData.name.trim(),
        description: pendingData.description.trim(),
        tokenSymbol: pendingData.tokenSymbol || 'NOVA',
        rewardRate: pendingData.rewardRate,
        eligibleAction: pendingData.eligibleAction,
        minSpend: pendingData.minSpend || null,
        maxRewardPerUser: pendingData.maxRewardPerUser || null,
        totalBudget: pendingData.totalBudget,
        startDate: pendingData.startDate,
        endDate: pendingData.endDate,
      };

      if (editData?.id) {
        await api.patch(`/api/campaigns/${editData.id}`, payload, { headers: { 'x-api-key': apiKey } });
      } else {
        await api.post('/api/campaigns', payload, { headers: { 'x-api-key': apiKey } });
      }

      setPendingData(null);
      onSuccess?.();
    } catch (err) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  const initialData = editData
    ? {
        name: editData.name || '',
        description: editData.description || '',
        tokenSymbol: editData.token_symbol || 'NOVA',
        rewardRate: editData.reward_rate || '',
        eligibleAction: editData.eligible_action || 'purchase',
        minSpend: editData.min_spend || '',
        maxRewardPerUser: editData.max_reward_per_user || '',
        totalBudget: editData.total_budget || '',
        startDate: editData.start_date?.slice(0, 10) || '',
        endDate: editData.end_date?.slice(0, 10) || '',
        tokenRows: editData.token_rows?.length ? editData.token_rows : [createTokenRow()],
      }
    : { ...INITIAL_DATA, tokenRows: [createTokenRow()] };

  return (
    <>
      <MultiStepForm
        steps={STEPS}
        initialData={initialData}
        onSubmit={handleReviewSubmit}
        renderSummary={renderSummary}
        urlParamKey="campaign-step"
      />
      {pendingData && (
        <TxConfirmModal
          data={pendingData}
          onConfirm={handleConfirm}
          onCancel={() => setPendingData(null)}
          submitting={submitting}
        />
      )}
    </>
  );
}
