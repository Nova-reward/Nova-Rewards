'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '../context/WalletContext';
import api from '../lib/api';
import TransactionLink from './TransactionLink';

/**
 * Detects whether the connected wallet has a NOVA trustline and, if not,
 * prompts the user to establish one before proceeding with a reward claim.
 *
 * Flow:
 *  1. On mount (or when publicKey changes) → check trustline via backend.
 *  2. If missing → show "Establish Trustline" prompt.
 *  3. On click → fetch unsigned XDR, sign via unified signTransaction, submit.
 *  4. On success → call onSuccess() so the parent can proceed with the claim.
 *
 * Requirements: #661
 *
 * @param {{ onSuccess?: () => void, assetCode?: string, issuer?: string }} props
 */
export default function TrustlineButton({ onSuccess, assetCode = 'NOVA', issuer }) {
  const { publicKey, signTransaction } = useWallet();
  const [trustlineExists, setTrustlineExists] = useState(null); // null = checking
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState('');

  // Check trustline status whenever the connected wallet changes
  useEffect(() => {
    if (!publicKey) return;
    setTrustlineExists(null);

    api
      .get('/api/trustline/verify', { params: { walletAddress: publicKey } })
      .then(({ data }) => setTrustlineExists(data.exists))
      .catch(() => setTrustlineExists(false));
  }, [publicKey]);

  // Nothing to render if wallet not connected or trustline already exists
  if (!publicKey || trustlineExists === true) return null;

  // Still checking
  if (trustlineExists === null) {
    return <p className="text-sm text-gray-400">Checking trustline…</p>;
  }

  async function handleEstablish() {
    setStatus('loading');
    setMessage('');
    setTxHash('');
    try {
      // 1. Get unsigned XDR from backend
      const { data } = await api.post('/api/trustline/build', {
        walletAddress: publicKey,
        assetCode,
        issuer,
      });

      // 2. Sign with whichever wallet is connected
      const signedXdr = await signTransaction(data.xdr);

      // 3. Submit to Horizon via backend
      const submitRes = await api.post('/api/trustline/submit', { signedXdr });
      setTxHash(submitRes.data.txHash);
      setTrustlineExists(true);
      setStatus('done');
      setMessage('Trustline established successfully.');
      onSuccess?.();
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || err.message || 'Failed to establish trustline.');
    }
  }

  return (
    <div className="rounded-xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-4 space-y-2">
      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
        ⚠️ A NOVA trustline is required before you can receive rewards.
      </p>
      <button
        className="btn btn-secondary"
        onClick={handleEstablish}
        disabled={status === 'loading' || status === 'done'}
      >
        {status === 'loading'
          ? 'Establishing trustline…'
          : status === 'done'
          ? '✓ Trustline active'
          : 'Establish NOVA Trustline'}
      </button>
      {message && (
        <p className={`text-sm ${status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {message}
          {txHash && (
            <span>
              {' '}Transaction: <TransactionLink txHash={txHash} />
            </span>
          )}
        </p>
      )}
    </div>
  );
}
