'use client';

import { useState } from 'react';
import MultiStepForm from './MultiStepForm';
import api from '../lib/api';

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
          <label className="label">Campaign Name</label>
          <input
            className="input"
            value={data.name ?? ''}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Summer Rewards 2026"
            aria-describedby={errors.name ? 'name-err' : undefined}
          />
          {errors.name && <p id="name-err" className="error">{errors.name}</p>}

          <label className="label" style={{ marginTop: '1rem' }}>Description</label>
          <textarea
            className="input"
            rows={3}
            value={data.description ?? ''}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Earn NOVA tokens on every purchase."
            aria-describedby={errors.description ? 'desc-err' : undefined}
          />
          {errors.description && <p id="desc-err" className="error">{errors.description}</p>}
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
      return (
        <>
          <label className="label">Token Symbol</label>
          <input
            className="input"
            value={data.tokenSymbol ?? 'NOVA'}
            onChange={(e) => update('tokenSymbol', e.target.value.toUpperCase())}
            placeholder="NOVA"
            maxLength={12}
            aria-describedby={errors.tokenSymbol ? 'sym-err' : undefined}
          />
          {errors.tokenSymbol && <p id="sym-err" className="error">{errors.tokenSymbol}</p>}

          <label className="label" style={{ marginTop: '1rem' }}>Reward Rate (tokens per unit of spend)</label>
          <input
            className="input"
            type="number"
            min="0.0000001"
            step="any"
            value={data.rewardRate ?? ''}
            onChange={(e) => update('rewardRate', e.target.value)}
            placeholder="1.5"
            aria-describedby={errors.rewardRate ? 'rate-err' : undefined}
          />
          {errors.rewardRate && <p id="rate-err" className="error">{errors.rewardRate}</p>}
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
          <label className="label">Minimum Spend to Qualify (optional)</label>
          <input
            className="input"
            type="number"
            min="0"
            step="any"
            value={data.minSpend ?? ''}
            onChange={(e) => update('minSpend', e.target.value)}
            placeholder="0"
            aria-describedby={errors.minSpend ? 'min-err' : undefined}
          />
          {errors.minSpend && <p id="min-err" className="error">{errors.minSpend}</p>}

          <label className="label" style={{ marginTop: '1rem' }}>Max Reward Per User (optional)</label>
          <input
            className="input"
            type="number"
            min="0"
            step="any"
            value={data.maxRewardPerUser ?? ''}
            onChange={(e) => update('maxRewardPerUser', e.target.value)}
            placeholder="Unlimited"
            aria-describedby={errors.maxRewardPerUser ? 'max-err' : undefined}
          />
          {errors.maxRewardPerUser && <p id="max-err" className="error">{errors.maxRewardPerUser}</p>}

          <label className="label" style={{ marginTop: '1rem' }}>Eligible Actions</label>
          <select
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
          <label className="label">Total Budget (NOVA tokens)</label>
          <input
            className="input"
            type="number"
            min="1"
            step="any"
            value={data.totalBudget ?? ''}
            onChange={(e) => update('totalBudget', e.target.value)}
            placeholder="10000"
            aria-describedby={errors.totalBudget ? 'budget-err' : undefined}
          />
          {errors.totalBudget && <p id="budget-err" className="error">{errors.totalBudget}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label className="label">Start Date</label>
              <input
                className="input"
                type="date"
                value={data.startDate ?? ''}
                onChange={(e) => update('startDate', e.target.value)}
                aria-describedby={errors.startDate ? 'start-err' : undefined}
              />
              {errors.startDate && <p id="start-err" className="error">{errors.startDate}</p>}
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                className="input"
                type="date"
                value={data.endDate ?? ''}
                onChange={(e) => update('endDate', e.target.value)}
                aria-describedby={errors.endDate ? 'end-err' : undefined}
              />
              {errors.endDate && <p id="end-err" className="error">{errors.endDate}</p>}
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
  totalBudget: '', startDate: '', endDate: '',
};

export default function CampaignForm({ merchantId, apiKey, onSuccess, editData }) {
  const [pendingData, setPendingData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Called by MultiStepForm when user clicks "Submit" on the review screen
  async function handleReviewSubmit(data) {
    setPendingData(data); // show confirmation modal
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
      throw err; // bubble up to MultiStepForm's submitError handler
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
      }
    : INITIAL_DATA;

  return (
    <>
      <MultiStepForm
        steps={STEPS}
        initialData={initialData}
        storageKey={`campaign-form-${merchantId}`}
        onSubmit={handleReviewSubmit}
        renderSummary={renderSummary}
        urlParamKey="step"
      />

      {pendingData && (
        <TxConfirmModal
          data={pendingData}
          submitting={submitting}
          onConfirm={handleConfirm}
          onCancel={() => setPendingData(null)}
        />
      )}
    </>
  );
}
