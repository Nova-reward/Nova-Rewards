'use client';

import { useCallback } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * TokenExpiryWarning — modal shown 2 minutes before JWT expiry.
 * Allows user to extend session or logout.
 *
 * @param {{
 *   isOpen: boolean,
 *   onStayLoggedIn: () => Promise<void>,
 *   onLogout: () => void,
 *   expiresInSeconds: number,
 *   loading?: boolean,
 * }} props
 */
export default function TokenExpiryWarning({
  isOpen,
  onStayLoggedIn,
  onLogout,
  expiresInSeconds,
  loading = false,
}) {
  const minutes = Math.floor(expiresInSeconds / 60);
  const seconds = Math.floor(expiresInSeconds % 60);

  const handleStayLoggedIn = useCallback(async () => {
    await onStayLoggedIn();
  }, [onStayLoggedIn]);

  const handleLogout = useCallback(() => {
    onLogout();
  }, [onLogout]);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleLogout}
      onConfirm={handleStayLoggedIn}
      title="Session Expiring Soon"
      message={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p>
            Your session will expire in <strong>{minutes}m {seconds}s</strong>.
          </p>
          <p>
            Click <strong>Stay Logged In</strong> to refresh your session and continue working
            without interruption.
          </p>
        </div>
      }
      confirmText="Stay Logged In"
      cancelText="Log Out"
      loading={loading}
      destructive={false}
    />
  );
}
