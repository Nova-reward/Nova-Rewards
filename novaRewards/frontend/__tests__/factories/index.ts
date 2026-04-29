/**
 * Test Data Factories — Nova Rewards Frontend
 *
 * Matches the domain types in frontend/types/index.ts.
 * Uses @faker-js/faker directly (no fishery dependency in frontend).
 *
 * Usage:
 *   import { buildUser, buildCampaign, buildTransaction,
 *            buildReward, buildWallet, buildRedemption } from '../__tests__/factories';
 *
 *   const user        = buildUser();
 *   const admin       = buildUser({ role: 'admin' });
 *   const expired     = buildCampaign({ endDate: '2020-01-01' });
 *   const txList      = Array.from({ length: 10 }, buildTransaction);
 */

import { faker } from '@faker-js/faker';
import type {
  User,
  Campaign,
  Transaction,
  Reward,
  Redemption,
} from '../../types/index';

// ── Helpers ───────────────────────────────────────────────────────────────

const stellarAddress = (): string =>
  'G' + faker.string.alphanumeric({ length: 55, casing: 'upper' });

const isoDate = (d: Date): string => d.toISOString().split('T')[0];

const daysAgo   = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

// ── User ──────────────────────────────────────────────────────────────────

export const buildUser = (overrides: Partial<User> = {}): User => ({
  id: faker.number.int({ min: 1, max: 100_000 }),
  walletAddress: stellarAddress(),
  email: faker.internet.email(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  role: 'user',
  createdAt: faker.date.recent({ days: 180 }).toISOString(),
  ...overrides,
});

export const buildAdminUser    = (overrides: Partial<User> = {}) => buildUser({ role: 'admin',    ...overrides });
export const buildMerchantUser = (overrides: Partial<User> = {}) => buildUser({ role: 'merchant', ...overrides });

// ── Campaign ──────────────────────────────────────────────────────────────

export const buildCampaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: faker.number.int({ min: 1, max: 10_000 }),
  merchantId: faker.number.int({ min: 1, max: 1_000 }),
  name: `${faker.commerce.productName()} Rewards`,
  rewardRate: parseFloat(faker.number.float({ min: 0.01, max: 0.1, fractionDigits: 4 })),
  startDate: isoDate(faker.date.recent({ days: 30 })),
  endDate: isoDate(daysAhead(faker.number.int({ min: 7, max: 90 }))),
  onChainStatus: 'confirmed',
  contractCampaignId: faker.string.hexadecimal({ length: 64, casing: 'lower' }).replace('0x', ''),
  createdAt: faker.date.recent({ days: 90 }).toISOString(),
  ...overrides,
});

export const buildExpiredCampaign = (overrides: Partial<Campaign> = {}) =>
  buildCampaign({
    startDate: isoDate(daysAgo(60)),
    endDate:   isoDate(daysAgo(1)),
    onChainStatus: 'confirmed',
    ...overrides,
  });

export const buildPendingCampaign = (overrides: Partial<Campaign> = {}) =>
  buildCampaign({ onChainStatus: 'pending', contractCampaignId: undefined, ...overrides });

// ── Transaction ───────────────────────────────────────────────────────────

export const buildTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: faker.number.int({ min: 1, max: 1_000_000 }),
  txHash: faker.string.hexadecimal({ length: 64, casing: 'lower' }).replace('0x', ''),
  txType: faker.helpers.arrayElement(['distribution', 'redemption', 'transfer'] as const),
  amount: parseFloat(faker.number.float({ min: 0.1, max: 1_000, fractionDigits: 7 })),
  fromWallet: stellarAddress(),
  toWallet: stellarAddress(),
  status: 'confirmed',
  createdAt: faker.date.recent({ days: 30 }).toISOString(),
  ...overrides,
});

export const buildPendingTransaction = (overrides: Partial<Transaction> = {}) =>
  buildTransaction({ status: 'pending', ...overrides });

export const buildFailedTransaction = (overrides: Partial<Transaction> = {}) =>
  buildTransaction({ status: 'failed', ...overrides });

// ── Reward ────────────────────────────────────────────────────────────────

export const buildReward = (overrides: Partial<Reward> = {}): Reward => ({
  id: faker.number.int({ min: 1, max: 10_000 }),
  name: faker.commerce.productName(),
  description: faker.commerce.productDescription(),
  pointsCost: faker.number.int({ min: 10, max: 5_000 }),
  stock: faker.number.int({ min: 1, max: 500 }),
  isActive: true,
  ...overrides,
});

export const buildOutOfStockReward = (overrides: Partial<Reward> = {}) =>
  buildReward({ stock: 0, ...overrides });

// ── Redemption ────────────────────────────────────────────────────────────

export const buildRedemption = (overrides: Partial<Redemption> = {}): Redemption => ({
  id: faker.number.int({ min: 1, max: 100_000 }),
  userId: faker.number.int({ min: 1, max: 10_000 }),
  rewardId: faker.number.int({ min: 1, max: 1_000 }),
  campaignId: faker.number.int({ min: 1, max: 100 }),
  pointsSpent: faker.number.int({ min: 10, max: 5_000 }),
  createdAt: faker.date.recent({ days: 30 }).toISOString(),
  ...overrides,
});

// ── Wallet (frontend shape) ───────────────────────────────────────────────

export interface WalletData {
  id: number;
  userId: number;
  address: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
}

export const buildWallet = (overrides: Partial<WalletData> = {}): WalletData => ({
  id: faker.number.int({ min: 1, max: 100_000 }),
  userId: faker.number.int({ min: 1, max: 10_000 }),
  address: stellarAddress(),
  isPrimary: false,
  isActive: true,
  createdAt: faker.date.recent({ days: 90 }).toISOString(),
  ...overrides,
});

export const buildPrimaryWallet = (overrides: Partial<WalletData> = {}) =>
  buildWallet({ isPrimary: true, ...overrides });

// ── List helpers ──────────────────────────────────────────────────────────

export const buildList = <T>(
  builder: (overrides?: Partial<T>) => T,
  count: number,
  overrides: Partial<T> = {},
): T[] => Array.from({ length: count }, () => builder(overrides));
