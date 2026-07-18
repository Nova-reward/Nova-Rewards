import { vi } from 'vitest';

// ── Prisma ────────────────────────────────────────────────────────────────

/**
 * Returns a mock PrismaClient where every model method is a vi.fn().
 * Usage: vi.mock('@prisma/client', () => ({ PrismaClient: createPrismaMock }))
 */
export function createPrismaMock() {
  const modelProxy = () =>
    new Proxy(
      {},
      {
        get: (_t, method) => vi.fn().mockResolvedValue(null),
      }
    );

  return new Proxy(
    {
      $connect: vi.fn().mockResolvedValue(undefined),
      $disconnect: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn((fn) => (typeof fn === 'function' ? fn(this) : Promise.resolve(fn))),
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        // Any model access (prisma.user, prisma.campaign, …) returns a model proxy
        target[prop] = modelProxy();
        return target[prop];
      },
    }
  );
}

// ── Redis ─────────────────────────────────────────────────────────────────

/**
 * Returns a mock Redis client with the most-used commands stubbed.
 * Usage: vi.mock('redis', () => ({ createClient: () => createRedisMock() }))
 */
export function createRedisMock() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setEx: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    incr: vi.fn().mockResolvedValue(1),
    hGet: vi.fn().mockResolvedValue(null),
    hSet: vi.fn().mockResolvedValue(1),
    hGetAll: vi.fn().mockResolvedValue({}),
    lPush: vi.fn().mockResolvedValue(1),
    lRange: vi.fn().mockResolvedValue([]),
    zAdd: vi.fn().mockResolvedValue(1),
    zRange: vi.fn().mockResolvedValue([]),
    zRangeWithScores: vi.fn().mockResolvedValue([]),
    publish: vi.fn().mockResolvedValue(0),
    subscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    isReady: true,
    isOpen: true,
  };
}

// ── Stellar SDK ───────────────────────────────────────────────────────────

/**
 * Returns a mock Stellar Horizon server with common methods stubbed.
 * Usage: vi.mock('stellar-sdk', () => ({ Server: createStellarServerMock, ... }))
 */
export function createStellarServerMock() {
  const accountCallBuilder = {
    accountId: vi.fn().mockReturnThis(),
    call: vi.fn().mockResolvedValue({
      id: 'GTEST000000000000000000000000000000000000000000000000000001',
      sequence: '1234567890',
      balances: [{ asset_type: 'native', balance: '100.0000000' }],
    }),
  };

  const transactionCallBuilder = {
    addOperation: vi.fn().mockReturnThis(),
    call: vi.fn().mockResolvedValue({ records: [] }),
  };

  return {
    loadAccount: vi.fn().mockResolvedValue({
      id: 'GTEST000000000000000000000000000000000000000000000000000001',
      sequence: '1234567890',
      balances: [{ asset_type: 'native', balance: '100.0000000' }],
      incrementSequenceNumber: vi.fn(),
    }),
    submitTransaction: vi.fn().mockResolvedValue({
      hash: 'abc123def456',
      ledger: 12345,
      successful: true,
    }),
    accounts: vi.fn().mockReturnValue(accountCallBuilder),
    transactions: vi.fn().mockReturnValue(transactionCallBuilder),
    fetchBaseFee: vi.fn().mockResolvedValue(100),
    fetchTimebounds: vi.fn().mockResolvedValue({ minTime: 0, maxTime: 0 }),
  };
}

/**
 * Minimal Stellar SDK module mock.
 * Usage: vi.mock('stellar-sdk', () => createStellarSdkMock())
 */
export function createStellarSdkMock() {
  return {
    Server: vi.fn().mockImplementation(createStellarServerMock),
    Keypair: {
      fromSecret: vi.fn((secret) => ({
        secret: () => secret,
        publicKey: () => 'GTEST000000000000000000000000000000000000000000000000000001',
        sign: vi.fn(),
      })),
      random: vi.fn(() => ({
        secret: () => 'STEST000000000000000000000000000000000000000000000000000001',
        publicKey: () => 'GTEST000000000000000000000000000000000000000000000000000001',
      })),
    },
    Asset: {
      native: vi.fn(() => ({ isNative: () => true })),
    },
    TransactionBuilder: vi.fn().mockImplementation(() => ({
      addOperation: vi.fn().mockReturnThis(),
      setTimeout: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue({
        toXDR: vi.fn().mockReturnValue('AAAA...'),
        sign: vi.fn(),
        toEnvelope: vi.fn().mockReturnValue({ toXDR: vi.fn().mockReturnValue('AAAA...') }),
      }),
    })),
    Operation: {
      payment: vi.fn().mockReturnValue({}),
      changeTrust: vi.fn().mockReturnValue({}),
      createAccount: vi.fn().mockReturnValue({}),
    },
    Networks: {
      TESTNET: 'Test SDF Network ; September 2015',
      PUBLIC: 'Public Global Stellar Network ; September 2015',
    },
    BASE_FEE: 100,
  };
}
