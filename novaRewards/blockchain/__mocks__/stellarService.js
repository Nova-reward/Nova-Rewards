/**
 * Manual vitest mock for novaRewards/blockchain/stellarService.js
 *
 * Used when vi.mock('../../blockchain/stellarService') is called without a
 * factory, providing proper vitest mock functions so that tests can call
 * .mockResolvedValue() / .mockRejectedValue() etc.
 */
import { vi } from 'vitest';
import { StrKey } from 'stellar-sdk';

export const server = {
  loadAccount: vi.fn(),
  submitTransaction: vi.fn(),
  transactions: vi.fn(() => ({
    transaction: vi.fn(() => ({
      call: vi.fn(),
    })),
  })),
};

export const NOVA = {
  code: 'NOVA',
  issuer: process.env.ISSUER_PUBLIC || 'GTESTISSUER',
};

export const isValidStellarAddress = vi.fn((addr) => {
  if (typeof addr !== 'string') return false;
  try {
    return StrKey.isValidEd25519PublicKey(addr);
  } catch {
    return false;
  }
});
