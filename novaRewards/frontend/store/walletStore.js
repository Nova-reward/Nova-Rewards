import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { connectWallet, isFreighterInstalled } from '../lib/freighter';
import { getNOVABalance, getTransactionHistory } from '../lib/horizonClient';

/**
 * walletStore manages wallet connection, balance, and transaction history.
 * Migrated from WalletContext for scalability and performance.
 * Requirements: Persistence for public key, DevTools support.
 */
export const useWalletStore = create(
  devtools(
    persist(
      (set, get) => ({
        publicKey: null,
        balance: '0',
        transactions: [],
        freighterInstalled: null,
        isLoading: false,
        error: null,

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
            set({ error: err.message }, false, 'wallet/refreshBalanceError');
          } finally {
            set({ isLoading: false }, false, 'wallet/refreshBalanceEnd');
          }
        },

        /**
         * Connects Freighter wallet, checks installation, and loads initial data.
         */
        connect: async () => {
          set({ isLoading: true, error: null }, false, 'wallet/connectStart');
          try {
            const installed = await isFreighterInstalled();
            set({ freighterInstalled: installed }, false, 'wallet/checkFreighter');

            if (!installed) {
              set({ error: 'Freighter wallet extension is not installed.' }, false, 'wallet/connectErrorNonInstalled');
              return;
            }

            const key = await connectWallet();
            set({ publicKey: key }, false, 'wallet/setPublicKey');
            await get().refreshBalance(key);
          } catch (err) {
            set({ error: err.message }, false, 'wallet/connectError');
          } finally {
            set({ isLoading: false }, false, 'wallet/connectEnd');
          }
        },

        /**
         * Disconnects the wallet and clears all session-related state.
         */
        disconnect: () => 
          set(
            { publicKey: null, balance: '0', transactions: [], error: null }, 
            false, 
            'wallet/disconnect'
          ),
      }),
      {
        name: 'nova-wallet-storage',
        partialize: (state) => ({ 
          publicKey: state.publicKey 
        }), // Only persist the public key, not balance/transactions which should be fresh
      }
    ),
    { name: 'WalletStore' }
  )
);
