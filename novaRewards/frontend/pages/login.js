'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * Validation schema for login form
 * Requirements: 163.2
 */
const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

/**
 * Login page component
 * Requirements: 163.1, 163.2, 163.3
 */
function LoginContent() {
  const router = useRouter();
  const { login, loading, error, clearError } = useAuth();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  /**
   * Handle form submission
   * Requirements: 163.2, 163.3
   */
  const onSubmit = async (data) => {
    setSubmitError('');
    clearError();

    const result = await login(data);

    if (result.success) {
      // Redirect to dashboard
      router.push('/dashboard');
    } else {
      setSubmitError(result.error || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-logo">⭐ NovaRewards</h1>
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          {/* Error display */}
          {(submitError || error) && (
            <div className="error-banner">
              <span>{submitError || error}</span>
              <button type="button" onClick={() => { setSubmitError(''); clearError(); }}>
                ×
              </button>
            </div>
          )}

          {/* Email field */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className={`form-input ${errors.email ? 'input-error' : ''}`}
              placeholder="Enter your email"
              {...register('email')}
            />
            {errors.email && (
              <span className="error-message">{errors.email.message}</span>
            )}
          </div>

          {/* Password field */}
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={`form-input ${errors.password ? 'input-error' : ''}`}
              placeholder="Enter your password"
              {...register('password')}
            />
            {errors.password && (
              <span className="error-message">{errors.password.message}</span>
            )}
          </div>

          {/* Forgot password link */}
          <div className="form-row">
            <Link href="/forgot-password" className="auth-link-small">
              Forgot password?
            </Link>
          </div>

          {/* Submit button with loading state */}
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isSubmitting || loading}
          >
            {(isSubmitting || loading) ? (
              <span className="btn-loading">
                <span className="spinner"></span>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link href="/register" className="auth-link">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <ErrorBoundary>
      <LoginContent />
    </ErrorBoundary>
  );
}
