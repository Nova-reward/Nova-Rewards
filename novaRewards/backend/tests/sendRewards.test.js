// Feature: nova-rewards, distributeRewards
// Validates: Requirements 3.2, 3.3, 3.6

// jest.mock factories are hoisted before any code runs, so env vars set here
// are NOT available inside the factory. Use hardcoded valid keys.
// These are throwaway testnet keypairs - not used in production.
const ISSUER_KEY = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
const DIST_SECRET = 'SDCAOELAD27GUNRPWJ2QXINWREZVTMOQF4UXIYVBHJSYLU6V4KKJJTJA';

// Mock stellarService before any module that depends on it is required
jest.mock('../../blockchain/stellarService', () => {
  const { Asset } = require('stellar-sdk');
  return {
    server: {
      loadAccount: jest.fn(),
      submitTransaction: jest.fn(),
    },
    NOVA: new Asset('NOVA', 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K'),
  };
});

// Mock trustline - isolates verifyTrustline from its own Horizon dependency
jest.mock('../../blockchain/trustline', () => ({
  verifyTrustline: jest.fn(),
}));

// Set env vars after mocks are declared
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.ISSUER_PUBLIC = ISSUER_KEY;
process.env.STELLAR_NETWORK = 'testnet';
process.env.DISTRIBUTION_SECRET = DIST_SECRET;

const { Keypair, Account } = require('stellar-sdk');
const { server } = require('../../blockchain/stellarService');
const { verifyTrustline } = require('../../blockchain/trustline');
const { distributeRewards } = require('../../blockchain/sendRewards');

const DIST_KEYPAIR = Keypair.fromSecret(DIST_SECRET);
const RECIPIENT = Keypair.random().publicKey();

// Build a mock account using stellar-sdk Account so TransactionBuilder works correctly
function mockDistributionAccount(novaBal) {
  novaBal = novaBal || '500.0000000';
  const acc = new Account(DIST_KEYPAIR.publicKey(), '1000');
  acc.balances = [
    {
      asset_type: 'credit_alphanum4',
      asset_code: 'NOVA',
      asset_issuer: ISSUER_KEY,
      balance: novaBal,
    },
  ];
  return acc;
}

beforeEach(function() {
  jest.clearAllMocks();
});

describe('distributeRewards', function() {
  describe('happy path', function() {
    test('returns { success: true, txHash } when trustline exists and balance is sufficient', async function() {
      verifyTrustline.mockResolvedValue({ exists: true });
      server.loadAccount.mockResolvedValue(mockDistributionAccount('500.0000000'));
      server.submitTransaction.mockResolvedValue({ hash: 'abc123txhash' });

      const result = await distributeRewards({ toWallet: RECIPIENT, amount: '10' });

      expect(result).toEqual({ success: true, txHash: 'abc123txhash' });
      expect(verifyTrustline).toHaveBeenCalledWith(RECIPIENT);
      expect(server.loadAccount).toHaveBeenCalledWith(DIST_KEYPAIR.publicKey());
      expect(server.submitTransaction).toHaveBeenCalledTimes(1);
    });

    test('passes a signed transaction object to submitTransaction', async function() {
      verifyTrustline.mockResolvedValue({ exists: true });
      server.loadAccount.mockResolvedValue(mockDistributionAccount('100.0000000'));
      server.submitTransaction.mockResolvedValue({ hash: 'deadbeef' });

      await distributeRewards({ toWallet: RECIPIENT, amount: '50' });

      const submittedTx = server.submitTransaction.mock.calls[0][0];
      expect(submittedTx).toBeTruthy();
    });
  });

  describe('error path: no trustline', function() {
    test('throws with code no_trustline when recipient has no NOVA trustline', async function() {
      verifyTrustline.mockResolvedValue({ exists: false });

      await expect(
        distributeRewards({ toWallet: RECIPIENT, amount: '10' })
      ).rejects.toMatchObject({
        code: 'no_trustline',
        message: expect.stringContaining('trustline'),
      });

      expect(server.loadAccount).not.toHaveBeenCalled();
      expect(server.submitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('error path: insufficient balance', function() {
    test('throws with code insufficient_balance when distribution account balance is too low', async function() {
      verifyTrustline.mockResolvedValue({ exists: true });
      server.loadAccount.mockResolvedValue(mockDistributionAccount('5.0000000'));

      await expect(
        distributeRewards({ toWallet: RECIPIENT, amount: '10' })
      ).rejects.toMatchObject({
        code: 'insufficient_balance',
        message: expect.stringContaining('insufficient'),
      });

      expect(server.submitTransaction).not.toHaveBeenCalled();
    });

    test('treats a missing NOVA balance entry as zero', async function() {
      verifyTrustline.mockResolvedValue({ exists: true });
      const acc = new Account(DIST_KEYPAIR.publicKey(), '1000');
      acc.balances = [{ asset_type: 'native', balance: '10.0000000' }];
      server.loadAccount.mockResolvedValue(acc);

      await expect(
        distributeRewards({ toWallet: RECIPIENT, amount: '1' })
      ).rejects.toMatchObject({ code: 'insufficient_balance' });
    });
  });

  describe('error path: Horizon submitTransaction throws', function() {
    test('propagates errors thrown by submitTransaction', async function() {
      verifyTrustline.mockResolvedValue({ exists: true });
      server.loadAccount.mockResolvedValue(mockDistributionAccount('500.0000000'));
      server.submitTransaction.mockRejectedValue(new Error('Horizon 400: tx_failed'));

      await expect(
        distributeRewards({ toWallet: RECIPIENT, amount: '10' })
      ).rejects.toThrow('Horizon 400: tx_failed');
    });
  });

  describe('happy path: trustline exists, sufficient balance, Horizon returns success', function() {
    test('calls verifyTrustline with recipient wallet', async function() {
      verifyTrustline.mockResolvedValue({ exists: true });
      server.loadAccount.mockResolvedValue(mockDistributionAccount('500.0000000'));
      server.submitTransaction.mockResolvedValue({ hash: 'abc123' });

      await distributeRewards({ toWallet: RECIPIENT, amount: '10' });

      expect(verifyTrustline).toHaveBeenCalledWith(RECIPIENT);
    });

    test('calls server.loadAccount with distribution account public key', async function() {
      verifyTrustline.mockResolvedValue({ exists: true });
      server.loadAccount.mockResolvedValue(mockDistributionAccount('500.0000000'));
      server.submitTransaction.mockResolvedValue({ hash: 'abc123' });

      await distributeRewards({ toWallet: RECIPIENT, amount: '10' });

      expect(server.loadAccount).toHaveBeenCalledWith(DIST_KEYPAIR.publicKey());
    });

    test('calls server.submitTransaction with signed transaction', async function() {
      verifyTrustline.mockResolvedValue({ exists: true });
      server.loadAccount.mockResolvedValue(mockDistributionAccount('500.0000000'));
      server.submitTransaction.mockResolvedValue({ hash: 'abc123' });

      await distributeRewards({ toWallet: RECIPIENT, amount: '10' });

      expect(server.submitTransaction).toHaveBeenCalledTimes(1);
      const submittedTx = server.submitTransaction.mock.calls[0][0];
      expect(submittedTx).toBeTruthy();
    });
  });

  describe('error path: no trustline', function() {
    test('does not call server.loadAccount when trustline does not exist', async function() {
      verifyTrustline.mockResolvedValue({ exists: false });

      await expect(
        distributeRewards({ toWallet: RECIPIENT, amount: '10' })
      ).rejects.toMatchObject({ code: 'no_trustline' });

      expect(server.loadAccount).not.toHaveBeenCalled();
    });

    test('does not call server.submitTransaction when trustline does not exist', async function() {
      verifyTrustline.mockResolvedValue({ exists: false });

      await expect(
        distributeRewards({ toWallet: RECIPIENT, amount: '10' })
      ).rejects.toMatchObject({ code: 'no_trustline' });

      expect(server.submitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('error path: Horizon throws', function() {
    test('propagates error when server.loadAccount throws', async function() {
      verifyTrustline.mockResolvedValue({ exists: true });
      server.loadAccount.mockRejectedValue(new Error('Horizon connection failed'));

      await expect(
        distributeRewards({ toWallet: RECIPIENT, amount: '10' })
      ).rejects.toThrow('Horizon connection failed');
    });

    test('propagates error when server.submitTransaction throws', async function() {
      verifyTrustline.mockResolvedValue({ exists: true });
      server.loadAccount.mockResolvedValue(mockDistributionAccount('500.0000000'));
      server.submitTransaction.mockRejectedValue(new Error('Horizon 500: internal error'));

      await expect(
        distributeRewards({ toWallet: RECIPIENT, amount: '10' })
      ).rejects.toThrow('Horizon 500: internal error');
    });
  });
});
