'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { connectWallet, isFreighterInstalled } from '../lib/freighter';
import { getNOVABalance, getTransactionHistory } from '../lib/horizonClient';

const WalletContext = createContext(null);

/**
 * Provides wallet state and actions to the entire app.
 * Requirements: 8.2, 8.3
 */
export function WalletProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [balance, setBalance] = useState('0');
  const [transactions, setTransactions] = useState([]);
  const [freighterInstalled, setFreighterInstalled] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('walletPublicKey');
    if (storedKey) {
      setPublicKey(storedKey);
      // Re-fetch balance after hydration
      Promise.all([
        getNOVABalance(storedKey),
        getTransactionHistory(storedKey),
      ]).then(([bal, txs]) => {
        setBalance(bal);
        setTransactions(txs);
      }).catch(() => {
        // If balance fetch fails, clear the stored key
        localStorage.removeItem('walletPublicKey');
        setPublicKey(null);
      });
    }
    setHydrated(true);
  }, []);

  /** Fetches and updates the current NOVA balance and transaction history. */
  const refreshBalance = useCallback(async (wallet) => {
    const key = wallet || publicKey;
    if (!key) return;
    const [bal, txs] = await Promise.all([
      getNOVABalance(key),
      getTransactionHistory(key),
    ]);
    setBalance(bal);
    setTransactions(txs);
  }, [publicKey]);

  /** Connects Freighter wallet and loads initial balance. */
  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const installed = await isFreighterInstalled();
      setFreighterInstalled(installed);

      if (!installed) {
        setError('Freighter wallet extension is not installed.');
        return;
      }

      const key = await connectWallet();
      setPublicKey(key);
      localStorage.setItem('walletPublicKey', key);
      await refreshBalance(key);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [refreshBalance]);

  /** Disconnects the wallet and clears all state. */
  const disconnect = useCallback(() => {
    setPublicKey(null);
    setBalance('0');
    setTransactions([]);
    setError(null);
    localStorage.removeItem('walletPublicKey');
  }, []);

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        balance,
        transactions,
        freighterInstalled,
        loading,
        error,
        connect,
        disconnect,
        refreshBalance,
        hydrated,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

/** Hook to consume wallet context. */
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
