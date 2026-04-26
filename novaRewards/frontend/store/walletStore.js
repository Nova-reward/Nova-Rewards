import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { connectWallet, isFreighterInstalled, sign, getNetworkPassphrase } from '../lib/freighter';
import { getNOVABalance, getTransactionHistory } from '../lib/horizonClient';

const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';

/**
 * User-friendly error messages for common wallet connection failures.
 */
const ERROR_MESSAGES = {
  not_installed: 'Freighter wallet extension is not installed. Please install it from freighter.app',
  access_denied: 'You denied wallet access. Please try again and approve the connection.',
  no_public_key: 'Could not retrieve your public key from Freighter.',
  sign_rejected: 'You rejected the signing request. Please try again.',
  sign_failed: 'Failed to sign transaction. Please try again.',
  refresh_failed: 'Failed to refresh wallet balance. Please check your connection.',
  generic: 'Something went wrong with your wallet. Please try again.',
};

function getUserFriendlyError(err) {
  const msg = err?.message?.toLowerCase() || '';
  if (msg.includes('not installed') || msg.includes('freighter')) return ERROR_MESSAGES.not_installed;
  if (msg.includes('denied') || msg.includes('rejected') || msg.includes('access')) return ERROR_MESSAGES.access_denied;
  if (msg.includes('public key')) return ERROR_MESSAGES.no_public_key;
  if (msg.includes('sign')) return ERROR_MESSAGES.sign_failed;
  return err?.message || ERROR_MESSAGES.generic;
}

/**
 * walletStore manages wallet connection, balance, signing, and transaction history.
 * Uses Zustand with persist middleware for localStorage persistence.
 * Connection state (publicKey, walletType, network) is persisted and restored on page load.
 */
export const useWalletStore = create(
  devtools(
    persist(
      (set, get) => ({
        publicKey: null,
        walletType: null,
        network: STELLAR_NETWORK,
        balance: '0',
        transactions: [],
        freighterInstalled: null,
        isLoading: false,
        isSigning: false,
        error: null,
        hydrated: false,

        /**
         * Called after rehydration to refresh balance from the network.
         * This ensures persisted state is validated against current on-chain data.
         */
        rehydrate: async () => {
          const { publicKey } = get();
          if (!publicKey) {
            set({ hydrated: true }, false, 'wallet/rehydrateNoKey');
            return;
          }

          try {
            const [bal, txs] = await Promise.all([
              getNOVABalance(publicKey),
              getTransactionHistory(publicKey),
            ]);
            set({ balance: bal, transactions: txs, hydrated: true }, false, 'wallet/rehydrateSuccess');
          } catch {
            // Persisted key may be stale — clear it
            set(
              { publicKey: null, walletType: null, balance: '0', transactions: [], hydrated: true },
              false,
              'wallet/rehydrateFailed',
            );
          }
        },

        /**
         * Fetches and updates the current NOVA balance and transaction history.
         * @param {string} wallet - Optional wallet address to fetch for.
         */
        refreshBalance: async (wallet) => {
          const key = wallet || get().publicKey;
          if (!key) return;

          set({ isLoading: true, error: null }, false, 'wallet/refreshBalanceStart');
          try {
            const [bal, txs] = await Promise.all([
              getNOVABalance(key),
              getTransactionHistory(key),
            ]);
            set({ balance: bal, transactions: txs }, false, 'wallet/refreshBalanceSuccess');
          } catch (err) {
            set({ error: ERROR_MESSAGES.refresh_failed }, false, 'wallet/refreshBalanceError');
          } finally {
            set({ isLoading: false }, false, 'wallet/refreshBalanceEnd');
          }
        },

        /**
         * Connects Freighter wallet, checks installation, and loads initial data.
         * Persists publicKey and walletType to localStorage via zustand/persist.
         */
        connect: async () => {
          set({ isLoading: true, error: null }, false, 'wallet/connectStart');
          try {
            const installed = await isFreighterInstalled();
            set({ freighterInstalled: installed }, false, 'wallet/checkFreighter');

            if (!installed) {
              set({ error: ERROR_MESSAGES.not_installed }, false, 'wallet/connectErrorNonInstalled');
              return;
            }

            const key = await connectWallet();
            set({ publicKey: key, walletType: 'freighter', network: STELLAR_NETWORK }, false, 'wallet/setPublicKey');
            await get().refreshBalance(key);
          } catch (err) {
            set({ error: getUserFriendlyError(err) }, false, 'wallet/connectError');
          } finally {
            set({ isLoading: false }, false, 'wallet/connectEnd');
          }
        },

        /**
         * Disconnects the wallet and clears all session-related state.
         * Removes persisted data from localStorage.
         */
        disconnect: () =>
          set(
            { publicKey: null, walletType: null, balance: '0', transactions: [], error: null, freighterInstalled: null },
            false,
            'wallet/disconnect',
          ),

        /**
         * Signs an XDR transaction using the connected Freighter wallet.
         * Returns the signed XDR string for the caller to submit.
         *
         * @param {string} xdr - Unsigned transaction XDR
         * @returns {Promise<string>} Signed transaction XDR
         */
        signTransaction: async (xdr) => {
          const { publicKey } = get();
          if (!publicKey) {
            throw new Error('No wallet connected. Please connect your wallet first.');
          }

          set({ isSigning: true, error: null }, false, 'wallet/signStart');
          try {
            const signedXdr = await sign(xdr);
            return signedXdr;
          } catch (err) {
            const friendlyError = getUserFriendlyError(err);
            set({ error: friendlyError }, false, 'wallet/signError');
            throw new Error(friendlyError);
          } finally {
            set({ isSigning: false }, false, 'wallet/signEnd');
          }
        },

        /**
         * Clears the current error state.
         */
        clearError: () => set({ error: null }, false, 'wallet/clearError'),
      }),
      {
        name: 'nova-wallet-storage',
        partialize: (state) => ({
          publicKey: state.publicKey,
          walletType: state.walletType,
          network: state.network,
        }),
        // After rehydration from localStorage, trigger balance refresh
        onRehydrateStorage: () => (state) => {
          if (state) {
            state.rehydrate();
          }
        },
      },
    ),
    { name: 'WalletStore' },
  ),
);
