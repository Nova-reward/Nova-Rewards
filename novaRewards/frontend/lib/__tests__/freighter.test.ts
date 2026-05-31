/**
 * Unit tests for lib/freighter.ts
 *
 * Covers:
 * - isFreighterInstalled()
 * - getFreighterPublicKey()
 * - getFreighterNetwork()
 * - checkNetworkMismatch()
 * - requireCorrectNetwork()
 * - sign()
 * - signAndSubmit()
 */

import {
  isFreighterInstalled,
  getFreighterPublicKey,
  getFreighterNetwork,
  checkNetworkMismatch,
  requireCorrectNetwork,
  sign,
  signAndSubmit,
  getNetworkPassphrase,
  getExpectedNetworkName,
  getHorizonUrl,
  FreighterError,
} from '../freighter';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockIsConnected = jest.fn();
const mockRequestAccess = jest.fn();
const mockGetPublicKey = jest.fn();
const mockSignTransaction = jest.fn();
const mockGetNetwork = jest.fn();

jest.mock('@stellar/freighter-api', () => ({
  isConnected: () => mockIsConnected(),
  requestAccess: () => mockRequestAccess(),
  getPublicKey: () => mockGetPublicKey(),
  signTransaction: (xdr: string, opts?: any) => mockSignTransaction(xdr, opts),
  getNetwork: () => mockGetNetwork(),
}));

global.fetch = jest.fn();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.resetAllMocks();
  process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FreighterError', () => {
  it('sets name, message, and code', () => {
    const err = new FreighterError('Something failed', 'TEST_CODE');
    expect(err.message).toBe('Something failed');
    expect(err.code).toBe('TEST_CODE');
    expect(err.name).toBe('FreighterError');
  });
});

describe('isFreighterInstalled', () => {
  it('returns true when Freighter reports isConnected=true', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    const result = await isFreighterInstalled();
    expect(result).toBe(true);
  });

  it('returns false when Freighter reports isConnected=false', async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false });
    const result = await isFreighterInstalled();
    expect(result).toBe(false);
  });

  it('returns false when the SDK throws', async () => {
    mockIsConnected.mockRejectedValue(new Error('Extension not found'));
    const result = await isFreighterInstalled();
    expect(result).toBe(false);
  });
});

describe('getFreighterPublicKey', () => {
  it('returns the public key on success', async () => {
    mockGetPublicKey.mockResolvedValue({ publicKey: 'GABC123' });
    const key = await getFreighterPublicKey();
    expect(key).toBe('GABC123');
  });

  it('throws FreighterError when SDK returns an error', async () => {
    mockGetPublicKey.mockResolvedValue({ error: 'User denied' });
    await expect(getFreighterPublicKey()).rejects.toThrow(FreighterError);
  });

  it('throws FreighterError when the SDK throws', async () => {
    mockGetPublicKey.mockRejectedValue(new Error('boom'));
    await expect(getFreighterPublicKey()).rejects.toThrow(FreighterError);
  });
});

describe('getFreighterNetwork', () => {
  it('returns network info on success', async () => {
    mockGetNetwork.mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    const net = await getFreighterNetwork();
    expect(net.network).toBe('TESTNET');
    expect(net.networkPassphrase).toContain('Test SDF');
  });

  it('throws FreighterError when SDK returns an error', async () => {
    mockGetNetwork.mockResolvedValue({ error: 'Not authorised' });
    await expect(getFreighterNetwork()).rejects.toThrow(FreighterError);
  });
});

describe('checkNetworkMismatch', () => {
  it('returns false when Freighter network matches expected network', async () => {
    mockGetNetwork.mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    const mismatch = await checkNetworkMismatch();
    expect(mismatch).toBe(false);
  });

  it('returns true when Freighter network name differs', async () => {
    mockGetNetwork.mockResolvedValue({
      network: 'PUBLIC',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    });
    const mismatch = await checkNetworkMismatch();
    expect(mismatch).toBe(true);
  });

  it('returns true when Freighter passphrase differs', async () => {
    mockGetNetwork.mockResolvedValue({
      network: 'CUSTOM',
      networkPassphrase: 'Some custom network',
    });
    const mismatch = await checkNetworkMismatch();
    expect(mismatch).toBe(true);
  });

  it('returns false when network read fails (graceful degradation)', async () => {
    mockGetNetwork.mockRejectedValue(new Error('unavailable'));
    const mismatch = await checkNetworkMismatch();
    expect(mismatch).toBe(false);
  });
});

describe('requireCorrectNetwork', () => {
  it('resolves when network matches', async () => {
    mockGetNetwork.mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    await expect(requireCorrectNetwork()).resolves.toBeUndefined();
  });

  it('throws NETWORK_MISMATCH when network differs', async () => {
    mockGetNetwork.mockResolvedValue({
      network: 'PUBLIC',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    });
    await expect(requireCorrectNetwork()).rejects.toThrow('Network mismatch');
  });
});

describe('sign', () => {
  it('returns signed XDR on success', async () => {
    mockGetNetwork.mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: 'signed123' });

    const result = await sign('unsignedXDR');
    expect(result).toBe('signed123');
    expect(mockSignTransaction).toHaveBeenCalledWith(
      'unsignedXDR',
      expect.objectContaining({ networkPassphrase: expect.any(String) }),
    );
  });

  it('throws FreighterError when user rejects', async () => {
    mockGetNetwork.mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    mockSignTransaction.mockRejectedValue(new Error('User rejected request'));
    await expect(sign('xdr')).rejects.toThrow('rejected');
  });

  it('throws FreighterError on network mismatch', async () => {
    mockGetNetwork.mockResolvedValue({
      network: 'PUBLIC',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    });
    await expect(sign('xdr')).rejects.toThrow('Network mismatch');
    expect(mockSignTransaction).not.toHaveBeenCalled();
  });
});

describe('signAndSubmit', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_HORIZON_URL = 'https://horizon-testnet.stellar.org';
  });

  it('returns txHash on successful submission', async () => {
    mockGetNetwork.mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: 'signedXDR' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ hash: 'abc123' }),
    });

    const result = await signAndSubmit('unsignedXDR');
    expect(result.txHash).toBe('abc123');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/transactions'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws FreighterError when Horizon returns an error', async () => {
    mockGetNetwork.mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: 'signedXDR' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ title: 'Bad Request', extras: { result_codes: { transaction: 'tx_bad_seq' } } }),
    });

    await expect(signAndSubmit('unsignedXDR')).rejects.toThrow('tx_bad_seq');
  });
});

describe('environment helpers', () => {
  it('getNetworkPassphrase returns TESTNET for testnet env', () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
    expect(getNetworkPassphrase()).toContain('Test SDF');
  });

  it('getNetworkPassphrase returns PUBLIC for mainnet env', () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'mainnet';
    expect(getNetworkPassphrase()).toContain('Public Global');
  });

  it('getExpectedNetworkName reflects the env', () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
    expect(getExpectedNetworkName()).toBe('TESTNET');
  });

  it('getHorizonUrl returns custom or default URL', () => {
    process.env.NEXT_PUBLIC_HORIZON_URL = 'https://custom.horizon.io';
    expect(getHorizonUrl()).toBe('https://custom.horizon.io');
  });
});

