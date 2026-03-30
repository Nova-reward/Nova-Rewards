'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DashboardLayout from '../components/DashboardLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { withAuth, useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTour } from '../context/TourContext';
import api from '../lib/api';

// ── Validation schemas ────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName:  z.string().min(1, 'Last name is required').max(100),
  bio:       z.string().max(1000, 'Bio must be 1000 characters or less').optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must contain uppercase, lowercase, and a number'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

// ── Sub-components ────────────────────────────────────────────────────────

function Banner({ type, message, onDismiss }) {
  if (!message) return null;
  return (
    <div className={type === 'success' ? 'success-banner' : 'error-banner'}>
      <span>{message}</span>
      <button type="button" onClick={onDismiss}>×</button>
    </div>
  );
}

// ── Personal Information ──────────────────────────────────────────────────

function PersonalInfoSection({ user }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.first_name || '',
      lastName:  user?.last_name  || '',
      bio:       user?.bio        || '',
    },
  });
  const [banner, setBanner] = useState(null);

  const onSubmit = async (data) => {
    setBanner(null);
    try {
      await api.patch(`/api/users/${user.id}`, data);
      setBanner({ type: 'success', message: 'Profile updated successfully.' });
    } catch (err) {
      setBanner({ type: 'error', message: err.response?.data?.message || 'Update failed.' });
    }
  };

  return (
    <div className="card">
      <h3 className="settings-section-title">Personal Information</h3>
      <Banner type={banner?.type} message={banner?.message} onDismiss={() => setBanner(null)} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">First Name</label>
            <input className={`form-input ${errors.firstName ? 'input-error' : ''}`} {...register('firstName')} />
            {errors.firstName && <span className="error-message">{errors.firstName.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Last Name</label>
            <input className={`form-input ${errors.lastName ? 'input-error' : ''}`} {...register('lastName')} />
            {errors.lastName && <span className="error-message">{errors.lastName.message}</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input className="form-input" value={user?.email || ''} readOnly disabled />
        </div>

        <div className="form-group">
          <label className="form-label">Bio</label>
          <textarea
            className={`form-input form-textarea ${errors.bio ? 'input-error' : ''}`}
            rows={3}
            {...register('bio')}
          />
          {errors.bio && <span className="error-message">{errors.bio.message}</span>}
        </div>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}

// ── Avatar Upload ─────────────────────────────────────────────────────────

function AvatarSection({ user }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(user?.avatar_url || null);
  const [pending, setPending] = useState(null); // File awaiting confirm
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    setError('');
    setSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('File must be 5 MB or smaller.');
      return;
    }
    setPending(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!pending) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('avatar', pending);
      const res = await api.post(`/api/users/${user.id}/profile-picture`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data.data.avatarUrl);
      setSuccess('Avatar updated.');
      setPending(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const initials = [user?.first_name, user?.last_name]
    .filter(Boolean).map((n) => n[0].toUpperCase()).join('') || 'U';

  return (
    <div className="card">
      <h3 className="settings-section-title">Profile Picture</h3>
      {error   && <div className="error-banner"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}
      {success && <div className="success-banner"><span>{success}</span><button onClick={() => setSuccess('')}>×</button></div>}

      <div className="avatar-upload-row">
        <button
          type="button"
          className="avatar-upload-btn"
          onClick={() => fileRef.current?.click()}
          aria-label="Change profile picture"
        >
          {preview
            ? <img src={preview} alt="Avatar preview" className="avatar-preview-img" />
            : <div className="avatar-placeholder">{initials}</div>
          }
          <div className="avatar-overlay">📷 Change</div>
        </button>

        <div className="avatar-upload-actions">
          <p className="avatar-hint">JPEG, PNG, or WebP · max 5 MB</p>
          {pending && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Confirm Upload'}
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}

// ── Change Password ───────────────────────────────────────────────────────

function PasswordSection({ user }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(passwordSchema),
  });
  const [banner, setBanner] = useState(null);

  const onSubmit = async (data) => {
    setBanner(null);
    try {
      await api.patch(`/api/users/${user.id}/password`, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setBanner({ type: 'success', message: 'Password changed successfully.' });
      reset();
    } catch (err) {
      setBanner({ type: 'error', message: err.response?.data?.message || 'Password change failed.' });
    }
  };

  return (
    <div className="card">
      <h3 className="settings-section-title">Change Password</h3>
      <Banner type={banner?.type} message={banner?.message} onDismiss={() => setBanner(null)} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group">
          <label className="form-label">Current Password</label>
          <input type="password" className={`form-input ${errors.currentPassword ? 'input-error' : ''}`} {...register('currentPassword')} />
          {errors.currentPassword && <span className="error-message">{errors.currentPassword.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">New Password</label>
          <input type="password" className={`form-input ${errors.newPassword ? 'input-error' : ''}`} {...register('newPassword')} />
          {errors.newPassword && <span className="error-message">{errors.newPassword.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Confirm New Password</label>
          <input type="password" className={`form-input ${errors.confirmPassword ? 'input-error' : ''}`} {...register('confirmPassword')} />
          {errors.confirmPassword && <span className="error-message">{errors.confirmPassword.message}</span>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

// ── Danger Zone ───────────────────────────────────────────────────────────

function DangerZoneSection({ user, onDeleted }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/api/users/${user.id}`);
      onDeleted();
    } catch (err) {
      setError(err.response?.data?.message || 'Deletion failed.');
      setDeleting(false);
    }
  };

  return (
    <div className="card danger-zone-card">
      <h3 className="settings-section-title danger-title">Danger Zone</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
        Permanently delete your account and all associated data. This cannot be undone.
      </p>
      {error && <div className="error-banner" style={{ marginBottom: '1rem' }}><span>{error}</span><button onClick={() => setError('')}>×</button></div>}

      {!showConfirm ? (
        <button className="btn btn-danger" onClick={() => setShowConfirm(true)}>
          Delete Account
        </button>
      ) : (
        <div className="danger-confirm">
          <p>Are you sure? This will permanently delete your account.</p>
          <div className="danger-confirm-actions">
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes, Delete My Account'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowConfirm(false)} disabled={deleting}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

function SettingsContent() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { startTour } = useTour();
  const router = require('next/router').useRouter();

  const handleDeleted = () => {
    logout();
    router.push('/');
  };

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <AvatarSection user={user} />
        <PersonalInfoSection user={user} />
        <PasswordSection user={user} />

        <div className="card">
          <h3 className="settings-section-title">Appearance</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9375rem' }}>Theme:</span>
            <button className="btn btn-secondary" onClick={toggleTheme}>
              {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="settings-section-title">Platform Tour</h3>
          <button className="btn btn-secondary" onClick={startTour}>🗺️ Restart Tour</button>
        </div>

        <DangerZoneSection user={user} onDeleted={handleDeleted} />
      </div>
    </DashboardLayout>
  );
}

function Settings() {
  return (
    <ErrorBoundary>
      <SettingsContent />
    </ErrorBoundary>
  );
}

export default withAuth(Settings);
