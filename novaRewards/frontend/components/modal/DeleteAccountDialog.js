'use client';

import { useState } from 'react';
import { useModal } from '../../context/ModalContext';
import FormModal from './FormModal';

/**
 * DeleteAccountDialog — example of the modal system in action.
 *
 * Uses:
 *  - `useModal().confirm` for the initial destructive confirmation
 *  - `FormModal` for the password-entry step
 *  - `useModal().alert` for the final success/error feedback
 *
 * @param {{ onDeleted?: () => void }} props
 */
export default function DeleteAccountDialog({ onDeleted }) {
  const { confirm, alert } = useModal();
  const [formOpen, setFormOpen] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleInitiate = async () => {
    const ok = await confirm({
      title: '🗑️ Delete Account',
      destructive: true,
      confirmText: 'Yes, continue',
      message: (
        <p>
          This will <strong>permanently delete</strong> your account and all associated
          rewards data. This action <strong>cannot be undone</strong>.
        </p>
      ),
    });
    if (ok) setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const password = e.target.password.value;
    if (!password) { setError('Password is required.'); return; }

    setLoading(true);
    setError('');
    try {
      // TODO: wire to API — DELETE /users/me  { body: { password } }
      await new Promise((r) => setTimeout(r, 1000)); // simulate request
      setFormOpen(false);
      await alert({ title: 'Account Deleted', variant: 'success', message: 'Your account has been permanently deleted.' });
      onDeleted?.();
    } catch (err) {
      setError(err?.message || 'Failed to delete account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="btn btn-danger" onClick={handleInitiate}>
        🗑️ Delete Account
      </button>

      <FormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setError(''); }}
        onSubmit={handleSubmit}
        title="🗑️ Confirm Account Deletion"
        submitText="Delete My Account"
        loading={loading}
        size="sm"
      >
        <p style={{ color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
          Enter your password to confirm permanent account deletion.
        </p>
        <label className="label" htmlFor="delete-password">Password</label>
        <input
          id="delete-password"
          name="password"
          type="password"
          className="input"
          placeholder="Your current password"
          autoComplete="current-password"
          required
        />
        {error && <p className="error">{error}</p>}
      </FormModal>
    </>
  );
}
