'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import ErrorBoundary from '../components/ErrorBoundary';

const schema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain uppercase, lowercase, and a number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

function ResetPasswordContent() {
  const router = useRouter();
  const { token } = router.query;
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ password }) => {
    setServerError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Reset failed. The link may have expired.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-logo">⭐ NovaRewards</h1>
          <h2 className="auth-title">New Password</h2>
          <p className="auth-subtitle">Choose a strong password for your account</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>✅</p>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Password updated!</p>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              You can now sign in with your new password.
            </p>
            <Link href="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>
              Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            {serverError && (
              <div className="error-banner">
                <span>{serverError}</span>
                <button type="button" onClick={() => setServerError('')}>×</button>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password" className="form-label">New Password</label>
              <input
                id="password"
                type="password"
                className={`form-input ${errors.password ? 'input-error' : ''}`}
                placeholder="Create a new password"
                {...register('password')}
              />
              {errors.password && <span className="error-message">{errors.password.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                className={`form-input ${errors.confirmPassword ? 'input-error' : ''}`}
                placeholder="Confirm your new password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && <span className="error-message">{errors.confirmPassword.message}</span>}
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={isSubmitting || !token}>
              {isSubmitting ? (
                <span className="btn-loading"><span className="spinner"></span>Updating…</span>
              ) : 'Update Password'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            <Link href="/login" className="auth-link">Back to Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <ErrorBoundary>
      <ResetPasswordContent />
    </ErrorBoundary>
  );
}
