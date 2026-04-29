import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../context/WalletContext';
import LoadingSkeleton from './LoadingSkeleton';

/**
 * WalletGuard - Protects routes that require wallet connection
 * Redirects to wallet-not-connected page if wallet is not connected
 */
export default function WalletGuard({ children, redirectTo = '/wallet-not-connected' }) {
  const router = useRouter();
  const { publicKey, loading } = useWallet();

  useEffect(() => {
    if (!loading && !publicKey) {
      // Store the intended destination for redirect after wallet connection
      sessionStorage.setItem('redirectAfterWallet', router.asPath);
      router.push(redirectTo);
    }
  }, [publicKey, loading, router, redirectTo]);

  // Show loading state while checking wallet connection
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Don't render children if wallet is not connected
  if (!publicKey) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Higher-order component to wrap pages with WalletGuard
 */
export function withWalletGuard(Component, guardProps = {}) {
  const WrappedComponent = (props) => (
    <WalletGuard {...guardProps}>
      <Component {...props} />
    </WalletGuard>
  );

  WrappedComponent.displayName = `withWalletGuard(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
