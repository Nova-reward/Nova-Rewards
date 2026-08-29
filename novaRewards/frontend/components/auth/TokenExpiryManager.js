'use client';

import { useAuth } from '../../context/AuthContext';
import TokenExpiryWarning from '../modal/TokenExpiryWarning';

/**
 * TokenExpiryManager — Displays the token expiry warning modal.
 * Mount this component in your main layout/app shell above the content.
 * Must be inside an AuthProvider.
 */
export default function TokenExpiryManager() {
  const {
    showTokenWarning,
    setShowTokenWarning,
    expiresIn,
    refreshAccessToken,
    logout,
    tokenRefreshLoading,
  } = useAuth();

  const handleStayLoggedIn = async () => {
    await refreshAccessToken();
  };

  const handleLogout = () => {
    setShowTokenWarning(false);
    logout();
  };

  return (
    <TokenExpiryWarning
      isOpen={showTokenWarning}
      onStayLoggedIn={handleStayLoggedIn}
      onLogout={handleLogout}
      expiresInSeconds={Math.max(0, expiresIn || 0)}
      loading={tokenRefreshLoading}
    />
  );
}
