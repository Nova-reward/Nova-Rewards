'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { connectWallet as connectFreighter, isFreighterInstalled } from '../lib/freighter';
import { getNOVABalance, getTransactionHistory } from '../lib/horizonClient';

const WalletContext = createContext(null);

/**
 * Connects via Albedo (web-based Stellar wallet).
 * Dynamically imports albedo-link to avoid SSR issues.
 */
async function connectAlbedo() {
  const albedo = (await import('albedo-link')).default;
  const result = await albedo.publicKey({ require_existing: false });
  if (!result.pubkey) throw new Error('Albedo did not return a public key.');
  return result.pubkey;
}

/**
 * Connects via xBull wallet extension.
 */
async function connectXBull() {
  if (!window.xBullSDK) throw new Error('xBull wallet extension is not installed.');
  const result = await window.xBullSDK.connect();
  const key = result?.publicKey || result;
  if (!key) throw new Error('xBull did not return a public key.');
  return key;
}

/**
 * Provides wallet state and actions to the entire app.
 * Supports Freighter, Albedo, and xBull.
 */
export function WalletProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [walletType, setWalletType] = useState(null);
  const [balance, setBalance] = useState('0');
  const [transactions, setTransactions] = useState([]);
  const [freighterInstalled, setFreighterInstalled] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('walletPublicKey');
    const storedType = localStorage.getItem('walletType');
    if (storedKey) {
      setPublicKey(storedKey);
      setWalletType(storedType);
      Promise.all([getNOVABalance(storedKey), getTransactionHistory(storedKey)])
        .then(([bal, txs]) => { setBalance(bal); setTransactions(txs); })
        .catch(() => {
          localStorage.removeItem('walletPublicKey');
          localStorage.removeItem('walletType');
          setPublicKey(null);
          setWalletType(null);
        });
    }
    setHydrated(true);
  }, []);

  const refreshBalance = useCallback(async (wallet) => {
    const key = wallet || publicKey;
    if (!key) return;
    try {
      const [bal, txs] = await Promise.all([getNOVABalance(key), getTransactionHistory(key)]);
      setBalance(bal);
      setTransactions(txs);
    } catch (err) {
      setError(err.message || 'Failed to refresh balance.');
    }
  }, [publicKey]);

  const connect = useCallback(async (type = 'freighter') => {
    setLoading(true);
    setError(null);
    try {
      let key;
      if (type === 'freighter') {
        const installed = await isFreighterInstalled();
        setFreighterInstalled(installed);
        if (!installed) throw new Error('Freighter wallet extension is not installed. Please install it from freighter.app');
        key = await connectFreighter();
      } else if (type === 'albedo') {
        key = await connectAlbedo();
      } else if (type === 'xbull') {
        key = await connectXBull();
      } else {
        throw new Error(`Unsupported wallet type: ${type}`);
      }

      setPublicKey(key);
      setWalletType(type);
      localStorage.setItem('walletPublicKey', key);
      localStorage.setItem('walletType', type);
      await refreshBalance(key);
    } catch (err) {
      setError(err.message || 'Failed to connect wallet. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshBalance]);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setWalletType(null);
    setBalance('0');
    setTransactions([]);
    setError(null);
    localStorage.removeItem('walletPublicKey');
    localStorage.removeItem('walletType');
  }, []);

  return (
    <WalletContext.Provider value={{
      publicKey,
      walletType,
      balance,
      transactions,
      freighterInstalled,
      loading,
      error,
      connect,
      disconnect,
      refreshBalance,
      hydrated,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
