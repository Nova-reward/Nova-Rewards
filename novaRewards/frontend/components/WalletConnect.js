'use client';

import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { truncateAddress } from '../lib/truncateAddress';

const WALLETS = [
  { id: 'freighter', label: 'Freighter', icon: '🔑', description: 'Browser extension' },
  { id: 'albedo', label: 'Albedo', icon: '🌐', description: 'Web-based wallet' },
  { id: 'xbull', label: 'xBull', icon: '🐂', description: 'Browser extension' },
];

/**
 * Multi-wallet connect button supporting Freighter, Albedo, and xBull.
 * Shows connected address + balance when connected.
 */
export default function WalletConnect() {
  const { publicKey, balance, connect, disconnect, loading, error, hydrated } = useWallet();
  const [showPicker, setShowPicker] = useState(false);
  const [connectError, setConnectError] = useState('');

  const handleConnect = async (walletId) => {
    setConnectError('');
    setShowPicker(false);
    try {
      await connect(walletId);
    } catch (err) {
      setConnectError(err.message || 'Failed to connect wallet.');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setConnectError('');
  };

  if (!hydrated) return null;

  if (publicKey) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Connected Wallet</p>
          <p style={{ fontFamily: 'monospace', fontWeight: 600 }}>{truncateAddress(publicKey)}</p>
          <p style={{ color: 'var(--accent)', fontWeight: 700 }}>{parseFloat(balance).toFixed(4)} NOVA</p>
        </div>
        <button className="btn btn-secondary" onClick={handleDisconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-primary"
        onClick={() => setShowPicker((v) => !v)}
        disabled={loading}
      >
        {loading ? (
          <span className="btn-loading"><span className="spinner"></span>Connecting…</span>
        ) : '🔗 Connect Wallet'}
      </button>

      {showPicker && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '0.75rem', minWidth: '220px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.5rem', padding: '0 0.25rem' }}>
            Choose a wallet
          </p>
          {WALLETS.map((w) => (
            <button
              key={w.id}
              onClick={() => handleConnect(w.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                width: '100%', padding: '0.6rem 0.75rem', background: 'none',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                color: 'var(--text)', textAlign: 'left',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontSize: '1.4rem' }}>{w.icon}</span>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{w.label}</p>
                <p style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{w.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {(connectError || error) && (
        <p className="error" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          {connectError || error}
        </p>
      )}
    </div>
  );
}
