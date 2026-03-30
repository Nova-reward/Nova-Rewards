'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import ErrorBoundary from '../components/ErrorBoundary';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

function ForgotPasswordContent() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email }) => {
    setServerError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-logo">⭐ NovaRewards</h1>
          <h2 className="auth-title">Reset Password</h2>
          <p className="auth-subtitle">Enter your email to receive a reset link</p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>📧</p>
            <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Check your inbox</p>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              If an account exists for that email, we've sent a password reset link.
            </p>
            <Link href="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>
              Back to Sign In
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
              <label htmlFor="email" className="form-label">Email Address</label>
              <input
                id="email"
                type="email"
                className={`form-input ${errors.email ? 'input-error' : ''}`}
                placeholder="Enter your email"
                {...register('email')}
              />
              {errors.email && <span className="error-message">{errors.email.message}</span>}
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="btn-loading"><span className="spinner"></span>Sending…</span>
              ) : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            Remember your password?{' '}
            <Link href="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPassword() {
  return (
    <ErrorBoundary>
      <ForgotPasswordContent />
    </ErrorBoundary>
  );
}
