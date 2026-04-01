'use client';
import { useState } from 'react';
import { signAndSubmit } from '../lib/freighter';
import api from '../lib/api';
import TransactionLink from './TransactionLink';

/**
 * Button that creates a NOVA trustline for the connected wallet.
 * Fetches unsigned XDR from backend, signs with Freighter, submits to Horizon.
 * Requirements: 2.1, 2.2
 */
export default function TrustlineButton({ onSuccess }) {
  const { publicKey: walletAddress } = useWalletStore();
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState('');

  async function handleCreateTrustline() {
    setStatus('loading');
    setMessage('');
    setTxHash('');
    try {
      const { data } = await api.post('/api/trustline/build', { walletAddress });

      const result = await signAndSubmit(data.xdr);
      setTxHash(result.txHash);
      setStatus('done');
      setMessage('Trustline created successfully.');
      onSuccess?.();
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || err.message);
    }
  }

  return (
    <div>
      <button
        className="btn btn-secondary"
        onClick={handleCreateTrustline}
        disabled={status === 'loading' || status === 'done'}
      >
        {status === 'loading' ? 'Creating trustline…' : status === 'done' ? '✓ Trustline active' : 'Create NOVA Trustline'}
      </button>
      {message && (
        <p className={status === 'error' ? 'error' : 'success'}>
          {message}
          {txHash && (
            <span> Transaction: <TransactionLink txHash={txHash} /></span>
          )}
        </p>
      )}
    </div>
  );
}
