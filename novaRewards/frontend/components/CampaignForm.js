'use client';

import MultiStepForm from './MultiStepForm';
import api from '../lib/api';

const STEPS = [
  {
    title: 'Campaign Details',
    validate(data) {
      const errors = {};
      if (!data.name?.trim()) errors.name = 'Campaign name is required.';
      if (!data.rewardRate || isNaN(Number(data.rewardRate)) || Number(data.rewardRate) <= 0)
        errors.rewardRate = 'Reward rate must be a positive number.';
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
            placeholder="Summer Rewards"
          />
          {errors.name && <p className="error">{errors.name}</p>}

          <label className="label" style={{ marginTop: '1rem' }}>
            Reward Rate (NOVA per unit of spend)
          </label>
          <input
            className="input"
            type="number"
            min="0.0000001"
            step="any"
            value={data.rewardRate ?? ''}
            onChange={(e) => update('rewardRate', e.target.value)}
            placeholder="1.5"
          />
          {errors.rewardRate && <p className="error">{errors.rewardRate}</p>}
        </>
      );
    },
  },
  {
    title: 'Schedule',
    validate(data) {
      const errors = {};
      if (!data.startDate) errors.startDate = 'Start date is required.';
      if (!data.endDate) errors.endDate = 'End date is required.';
      if (data.startDate && data.endDate && new Date(data.endDate) <= new Date(data.startDate))
        errors.endDate = 'End date must be after start date.';
      return errors;
    },
    fields(data, update, errors) {
      return (
        <>
          <label className="label">Start Date</label>
          <input
            className="input"
            type="date"
            value={data.startDate ?? ''}
            onChange={(e) => update('startDate', e.target.value)}
          />
          {errors.startDate && <p className="error">{errors.startDate}</p>}

          <label className="label" style={{ marginTop: '1rem' }}>End Date</label>
          <input
            className="input"
            type="date"
            value={data.endDate ?? ''}
            onChange={(e) => update('endDate', e.target.value)}
          />
          {errors.endDate && <p className="error">{errors.endDate}</p>}
        </>
      );
    },
  },
];

function renderSummary(data) {
  return (
    <dl className="msf-summary-list">
      <div className="msf-summary-row"><dt>Name</dt><dd>{data.name}</dd></div>
      <div className="msf-summary-row"><dt>Reward Rate</dt><dd>{data.rewardRate} NOVA</dd></div>
      <div className="msf-summary-row"><dt>Start Date</dt><dd>{data.startDate}</dd></div>
      <div className="msf-summary-row"><dt>End Date</dt><dd>{data.endDate}</dd></div>
    </dl>
  );
}

export default function CampaignForm({ merchantId, apiKey, onSuccess }) {
  async function handleSubmit(data) {
    await api.post(
      '/api/campaigns',
      {
        merchantId,
        name: data.name.trim(),
        rewardRate: data.rewardRate,
        startDate: data.startDate,
        endDate: data.endDate,
      },
      { headers: { 'x-api-key': apiKey } }
    );
    onSuccess?.();
  }

  return (
    <MultiStepForm
      steps={STEPS}
      initialData={{ name: '', rewardRate: '', startDate: '', endDate: '' }}
      storageKey={`campaign-form-${merchantId}`}
      onSubmit={handleSubmit}
      renderSummary={renderSummary}
    />
  );
}
