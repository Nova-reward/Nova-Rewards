'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import {
  getFreighterPublicKey,
  getFreighterNetwork,
  checkNetworkMismatch,
} from '../lib/freighter';

/**
 * useFreighterSync
 *
 * Subscribes to Freighter's accountChanged and networkChanged events
 * and reconciles them with the Zustand auth and wallet stores.
 *
 * Behavior:
 * - accountChanged:
 *     - If the new account matches the authenticated user's stellarPublicKey,
 *       update the wallet store's publicKey.
 *     - If the new account does NOT match, force logout from authStore
 *       (stale token residue is cleared atomically).
 * - networkChanged:
 *     - Re-read Freighter's network and update walletStore.networkMismatch.
 *       If a mismatch is detected, set a clear error (not a silent failure).
 *
 * The hook is a no-op when no wallet is connected or Freighter is not available.
 */
export default function useFreighterSync() {
  const authPublicKey = useAuthStore((s) => s.user?.stellarPublicKey);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);

  const walletPublicKey = useWalletStore((s) => s.publicKey);

  // Use refs to access latest store values inside event handlers
  const authPublicKeyRef = useRef(authPublicKey);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const walletPublicKeyRef = useRef(walletPublicKey);

  useEffect(() => {
    authPublicKeyRef.current = authPublicKey;
    isAuthenticatedRef.current = isAuthenticated;
    walletPublicKeyRef.current = walletPublicKey;
  }, [authPublicKey, isAuthenticated, walletPublicKey]);

  useEffect(() => {
    // Freighter exposes a global event emitter on window.freighter
    const freighter = typeof window !== 'undefined' ? window.freighter : undefined;
    if (!freighter || typeof freighter.on !== 'function') {
      return;
    }

    let isMounted = true;

    const handleAccountChanged = async (newPublicKey) => {
      if (!isMounted) return;

      const currentAuthKey = authPublicKeyRef.current;
      const currentWalletKey = walletPublicKeyRef.current;

      // Update wallet store publicKey to reflect Freighter's current account
      useWalletStore.setState({ publicKey: newPublicKey }, false, 'wallet/accountChanged');

      if (isAuthenticatedRef.current) {
        if (newPublicKey === currentAuthKey) {
          // Same account — ensure user data is in sync
          if (newPublicKey && newPublicKey !== currentWalletKey) {
            useWalletStore.setState({ publicKey: newPublicKey }, false, 'wallet/accountChangedSync');
          }
        } else {
          // Different account — force logout to clear stale auth tokens
          await logout();
          useWalletStore.setState(
            { error: 'Wallet account changed. Please log in again.' },
            false,
            'wallet/accountChangedLogout',
          );
        }
      }
    };

    const handleNetworkChanged = async () => {
      if (!isMounted) return;

      try {
        const netInfo = await getFreighterNetwork();
        const mismatch = await checkNetworkMismatch();

        if (!isMounted) return;

        useWalletStore.setState(
          { freighterNetwork: netInfo.network, networkMismatch: mismatch },
          false,
          'wallet/networkChanged',
        );

        if (mismatch) {
          useWalletStore.setState(
            {
              error: `Network mismatch: Please switch Freighter to ${netInfo.network === 'PUBLIC' ? 'Public' : 'Testnet'} before continuing.`,
            },
            false,
            'wallet/networkMismatch',
          );
        }
      } catch (err) {
        if (!isMounted) return;
        useWalletStore.setState(
          { error: 'Could not verify Freighter network after switch.' },
          false,
          'wallet/networkReadFailed',
        );
      }
    };

    // Subscribe to Freighter events
    freighter.on('accountChanged', handleAccountChanged);
    freighter.on('networkChanged', handleNetworkChanged);

    return () => {
      isMounted = false;
      try {
        freighter.off('accountChanged', handleAccountChanged);
        freighter.off('networkChanged', handleNetworkChanged);
      } catch {
        // Freighter may not implement off() in all versions; ignore cleanup errors
      }
    };
  }, [logout]);
}
