/**
 * rewards.js — Test reward distribution data generators.
 */

import { STELLAR_WALLETS } from './merchants.js';

export const REWARDS = {
  /**
   * Standard reward distribution (10 NOVA).
   */
  standard: () => ({
    walletAddress: STELLAR_WALLETS.customer1,
    amount: '10.0000000',
  }),

  /**
   * Bulk reward (100 NOVA).
   */
  bulk: () => ({
    walletAddress: STELLAR_WALLETS.customer1,
    amount: '100.0000000',
  }),

  /**
   * Minimal reward (tests floating-point precision).
   */
  minimal: () => ({
    walletAddress: STELLAR_WALLETS.customer2,
    amount: '0.0000001',
  }),

  /**
   * Invalid: negative amount.
   */
  negativeAmount: () => ({
    walletAddress: STELLAR_WALLETS.customer1,
    amount: '-10.0',
  }),

  /**
   * Invalid: zero amount.
   */
  zeroAmount: () => ({
    walletAddress: STELLAR_WALLETS.customer1,
    amount: '0',
  }),

  /**
   * Invalid: non-existent wallet.
   */
  invalidWallet: () => ({
    walletAddress: 'INVALID_WALLET_ADDRESS_123',
    amount: '10.0',
  }),

  /**
   * Valid wallet but no trustline (will be mocked as error).
   */
  noTrustline: () => ({
    walletAddress: STELLAR_WALLETS.customer3,
    amount: '10.0',
  }),
};
