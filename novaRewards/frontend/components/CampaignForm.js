'use client';
import { useState } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

/**
 * Form for creating a new reward campaign.
 * Client-side validation mirrors backend validateCampaign rules.
 * Requirements: 7.2, 7.3, 10.3
 */
export default function CampaignForm({ onSuccess }) {
  const { user: merchant, token: apiKey } = useAuthStore();
  const merchantId = merchant?.id;
  const [form, setForm] = useState({
    name: '',
    rewardRate: '',
    startDate: '',
    endDate: '',
  });
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  function validate() {
    const errors = [];
    if (!form.name.trim()) errors.push('Campaign name is required.');
    if (!form.rewardRate || isNaN(Number(form.rewardRate)) || Number(form.rewardRate) <= 0)
      errors.push('Reward rate must be a positive number.');
    if (!form.startDate || !form.endDate)
      errors.push('Start date and end date are required.');
    else if (new Date(form.endDate) <= new Date(form.startDate))
      errors.push('End date must be after start date.');
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    const errors = validate();
    if (errors.length > 0) {
      setMessage(errors.join(' '));
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      await api.post(
        '/api/campaigns',
        { merchantId, name: form.name.trim(), rewardRate: form.rewardRate, startDate: form.startDate, endDate: form.endDate },
        { headers: { 'x-api-key': apiKey } }
      );
      setStatus('done');
      setMessage('Campaign created successfully.');
      setForm({ name: '', rewardRate: '', startDate: '', endDate: '' });
      onSuccess?.();
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || err.message);
    }
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit}>
      <label className="label">Campaign Name</label>
      <input className="input" value={form.name} onChange={set('name')} placeholder="Summer Rewards" disabled={status === 'loading'} />

      <label className="label">Reward Rate (NOVA per unit of spend)</label>
      <input className="input" type="number" min="0.0000001" step="any" value={form.rewardRate} onChange={set('rewardRate')} placeholder="1.5" disabled={status === 'loading'} />

      <label className="label">Start Date</label>
      <input className="input" type="date" value={form.startDate} onChange={set('startDate')} disabled={status === 'loading'} />

      <label className="label">End Date</label>
      <input className="input" type="date" value={form.endDate} onChange={set('endDate')} disabled={status === 'loading'} />

      <button className="btn btn-primary" type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Creating…' : 'Create Campaign'}
      </button>
      {message && <p className={status === 'error' ? 'error' : 'success'}>{message}</p>}
    </form>
  );
}
