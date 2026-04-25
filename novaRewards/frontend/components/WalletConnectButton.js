'use client';

import { useWalletStore } from '../store/walletStore';
import { truncateAddress } from '../lib/truncateAddress';
import { Wallet, Unplug, AlertCircle, Loader2, Wifi } from 'lucide-react';

/**
 * WalletConnectButton — handles all connection states:
 *   idle       → "Connect Wallet" button
 *   connecting → spinner + "Connecting…"
 *   connected  → truncated address + balance + network badge + disconnect
 *   error      → error message with dismiss button
 *
 * Uses the enhanced useWalletStore (Zustand) which persists publicKey,
 * walletType, and network to localStorage and rehydrates on page load.
 */
export default function WalletConnectButton() {
  const {
    publicKey,
    walletType,
    network,
    balance,
    isLoading,
    error,
    hydrated,
    connect,
    disconnect,
    clearError,
  } = useWalletStore();

  // Don't render until localStorage rehydration is complete (avoids flash)
  if (!hydrated) return null;

  // --- Error state ---
  if (error && !publicKey) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="max-w-[200px] truncate">{error}</span>
        </div>
        <button
          onClick={() => { clearError(); connect(); }}
          className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
          aria-label="Retry wallet connection"
        >
          Retry
        </button>
        <button
          onClick={clearError}
          className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          aria-label="Dismiss error"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // --- Connected state ---
  if (publicKey) {
    const isTestnet = network !== 'mainnet';

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-brand-border dark:bg-brand-dark">
          <Wallet className="h-4 w-4 text-primary-600" aria-hidden="true" />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
              {truncateAddress(publicKey)}
            </span>
            <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
              {parseFloat(balance).toLocaleString()} NOVA
            </span>
          </div>
          {/* Network badge */}
          <span
            className={`ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
              isTestnet
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
            }`}
          >
            <Wifi className="h-2.5 w-2.5" aria-hidden="true" />
            {isTestnet ? 'Testnet' : 'Mainnet'}
          </span>
        </div>
        <button
          onClick={disconnect}
          aria-label="Disconnect wallet"
          className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors dark:border-brand-border dark:text-neutral-400 dark:hover:bg-red-950/30 dark:hover:text-red-400 dark:hover:border-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        >
          <Unplug className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Disconnect</span>
        </button>
      </div>
    );
  }

  // --- Connecting state ---
  if (isLoading) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white opacity-70 cursor-not-allowed"
        aria-label="Connecting to wallet"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Connecting…
      </button>
    );
  }

  // --- Idle state ---
  return (
    <button
      onClick={connect}
      aria-label="Connect wallet"
      className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
    >
      <Wallet className="h-4 w-4" aria-hidden="true" />
      Connect Wallet
    </button>
  );
}
