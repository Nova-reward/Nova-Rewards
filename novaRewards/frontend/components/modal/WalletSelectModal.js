'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '../../context/WalletContext';

const WALLET_OPTIONS = [
  {
    id: 'freighter',
    label: 'Freighter',
    description: 'Browser extension for Stellar',
    installUrl: 'https://freighter.app',
    icon: '🔑',
  },
  {
    id: 'walletconnect',
    label: 'WalletConnect',
    description: 'Connect a mobile wallet via QR code',
    installUrl: null, // no install needed — protocol-based
    icon: '📱',
  },
  {
    id: 'albedo',
    label: 'Albedo',
    description: 'Web-based Stellar wallet',
    installUrl: null,
    icon: '🌐',
  },
  {
    id: 'xbull',
    label: 'xBull',
    description: 'xBull browser extension',
    installUrl: 'https://xbull.app',
    icon: '🐂',
  },
];

/**
 * Modal that lets users pick a wallet provider.
 * Detects Freighter install status and shows an install link when missing.
 *
 * @param {{ isOpen: boolean, onClose: () => void }} props
 */
export default function WalletSelectModal({ isOpen, onClose }) {
  const { connect, loading, error, freighterInstalled } = useWallet();
  const [connectingId, setConnectingId] = useState(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSelect(walletId) {
    setConnectingId(walletId);
    try {
      await connect(walletId);
      onClose();
    } catch (_) {
      // error surfaced via useWallet().error
    } finally {
      setConnectingId(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="wallet-modal-title" className="text-lg font-semibold">
            Connect Wallet
          </h2>
          <button
            onClick={onClose}
            aria-label="Close wallet selector"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <ul className="space-y-2">
          {WALLET_OPTIONS.map((wallet) => {
            const isFreighterMissing =
              wallet.id === 'freighter' && freighterInstalled === false;
            const isConnecting = connectingId === wallet.id;

            return (
              <li key={wallet.id}>
                {isFreighterMissing ? (
                  <a
                    href={wallet.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="text-2xl">{wallet.icon}</span>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{wallet.label}</p>
                      <p className="text-xs text-gray-500">Not installed — click to install</p>
                    </div>
                    <span className="text-xs text-blue-500">Install ↗</span>
                  </a>
                ) : (
                  <button
                    onClick={() => handleSelect(wallet.id)}
                    disabled={loading}
                    className="flex items-center gap-3 w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    <span className="text-2xl">{wallet.icon}</span>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{wallet.label}</p>
                      <p className="text-xs text-gray-500">{wallet.description}</p>
                    </div>
                    {isConnecting && (
                      <span className="text-xs text-gray-400 animate-pulse">Connecting…</span>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
