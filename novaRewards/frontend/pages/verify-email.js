'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import api from '../lib/api';
import ErrorBoundary from '../components/ErrorBoundary';

function VerifyEmailContent() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState('verifying'); // verifying | success | error

  useEffect(() => {
    if (!token) return;
    api.post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-logo">⭐ NovaRewards</h1>
          <h2 className="auth-title">Email Verification</h2>
        </div>

        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          {status === 'verifying' && (
            <>
              <span className="spinner" style={{ display: 'inline-block', marginBottom: '1rem' }}></span>
              <p style={{ color: 'var(--muted)' }}>Verifying your email…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✅</p>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Email verified!</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Your account is now active. You can sign in.
              </p>
              <Link href="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>
                Sign In
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>❌</p>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Verification failed</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                The link may be invalid or expired. Please request a new one.
              </p>
              <Link href="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>
                Back to Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <ErrorBoundary>
      <VerifyEmailContent />
    </ErrorBoundary>
  );
}
