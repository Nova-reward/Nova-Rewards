'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { connectWallet as connectFreighter, isFreighterInstalled, signTransaction as freighterSign } from '../lib/freighter';
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
 * Connects via WalletConnect using the Stellar WalletConnect SDK.
 * Returns { publicKey, session } so the session can be stored for signing.
 */
async function connectWalletConnect() {
  const { StellarWalletsKit, WalletNetwork, WalletType } = await import(
    '@creit.tech/stellar-wallets-kit'
  );
  const network =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
      ? WalletNetwork.PUBLIC
      : WalletNetwork.TESTNET;

  const kit = new StellarWalletsKit({
    network,
    selectedWalletType: WalletType.WALLET_CONNECT,
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  });

  await kit.openModal({ onWalletSelected: async (option) => kit.setWallet(option.id) });
  const { address } = await kit.getAddress();
  if (!address) throw new Error('WalletConnect did not return a public key.');
  return { publicKey: address, kit };
}

/**
 * Provides wallet state and actions to the entire app.
 * Supports Freighter, Albedo, xBull, and WalletConnect.
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
  // WalletConnect kit instance kept in a ref (not serialisable to localStorage)
  const wcKitRef = useRef(null);

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
      } else if (type === 'walletconnect') {
        const { publicKey: wcKey, kit } = await connectWalletConnect();
        key = wcKey;
        wcKitRef.current = kit;
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
    if (wcKitRef.current) {
      try { wcKitRef.current.disconnect?.(); } catch (_) {}
      wcKitRef.current = null;
    }
    setPublicKey(null);
    setWalletType(null);
    setBalance('0');
    setTransactions([]);
    setError(null);
    localStorage.removeItem('walletPublicKey');
    localStorage.removeItem('walletType');
  }, []);

  /**
   * Unified sign method — delegates to the active wallet provider.
   *
   * @param {string} xdr - Unsigned transaction XDR
   * @returns {Promise<string>} Signed transaction XDR
   */
  const signTransaction = useCallback(async (xdr) => {
    if (!walletType) throw new Error('No wallet connected.');

    if (walletType === 'freighter') {
      const { signTransaction: freighterSignTx } = await import('@stellar/freighter-api');
      const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'PUBLIC' : 'TESTNET';
      const result = await freighterSignTx(xdr, { networkPassphrase: network });
      if (result.error) throw new Error(result.error);
      return result.signedTxXdr;
    }

    if (walletType === 'walletconnect') {
      if (!wcKitRef.current) throw new Error('WalletConnect session lost. Please reconnect.');
      const { signedTxXdr } = await wcKitRef.current.signTransaction(xdr, { address: publicKey });
      return signedTxXdr;
    }

    if (walletType === 'albedo') {
      const albedo = (await import('albedo-link')).default;
      const result = await albedo.tx({ xdr, submit: false });
      return result.signed_envelope_xdr;
    }

    if (walletType === 'xbull') {
      if (!window.xBullSDK) throw new Error('xBull wallet extension is not installed.');
      const result = await window.xBullSDK.signXDR(xdr);
      return result.signedXDR || result;
    }

    throw new Error(`signTransaction not implemented for wallet type: ${walletType}`);
  }, [walletType, publicKey]);

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
      signTransaction,
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
