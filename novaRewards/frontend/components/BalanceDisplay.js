'use client';

import { useEffect } from 'react';
import { useWalletStore } from '../store/walletStore';
import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * BalanceDisplay — Shows the authenticated user's live NOVA token balance
 * 
 * States:
 * - Loading: Shows skeleton while fetching from /api/wallet/balance
 * - Error: Shows — with tooltip explaining the fetch failure
 * - Success: Shows formatted balance with 7 decimal places
 * 
 * Automatically fetches balance on mount and can be manually refreshed.
 * Updates after successful transactions via parent component.
 */
export default function BalanceDisplay() {
  const {
    publicKey,
    balance,
    balanceLoading,
    balanceError,
    fetchBalanceFromAPI,
  } = useWalletStore();

  // Fetch balance when wallet is connected
  useEffect(() => {
    if (publicKey) {
      fetchBalanceFromAPI();
    }
  }, [publicKey, fetchBalanceFromAPI]);

  // Not connected
  if (!publicKey) {
    return null;
  }

  // Loading state - show skeleton
  if (balanceLoading) {
    return (
      <div className="flex flex-col leading-none gap-1">
        <div className="h-3 w-16 bg-gray-200 dark:bg-brand-border rounded animate-pulse" />
        <div className="h-3 w-20 bg-gray-200 dark:bg-brand-border rounded animate-pulse" />
      </div>
    );
  }

  // Error state - show — with tooltip
  if (balanceError) {
    return (
      <div className="flex flex-col leading-none gap-1 group relative">
        <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
          —
        </span>
        <span className="text-xs font-semibold text-red-600 dark:text-red-400">
          Error
        </span>
        {/* Tooltip */}
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-900 dark:bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50">
          {balanceError}
          <div className="absolute top-full left-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-800" />
        </div>
      </div>
    );
  }

  // Success state - show formatted balance with 7 decimal places
  const formattedBalance = parseFloat(balance).toLocaleString('en-US', {
    minimumFractionDigits: 7,
    maximumFractionDigits: 7,
  });

  return (
    <div className="flex flex-col leading-none gap-1">
      <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
        Balance
      </span>
      <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
        {formattedBalance} NOVA
      </span>
    </div>
  );
}
