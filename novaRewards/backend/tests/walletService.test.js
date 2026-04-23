// Mock dependencies before importing the service
jest.mock("../../blockchain/stellarService", () => ({
  server: {
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
    fetchBaseFee: jest.fn(),
    payments: jest.fn(),
    transactions: jest.fn(),
  },
  NOVA: { code: "NOVA", issuer: "ISSUER_PUBLIC_KEY" },
  isValidStellarAddress: jest.fn(),
  getNOVABalance: jest.fn(),
}));

jest.mock("../db/userRepository");
jest.mock("../db/transactionRepository");
jest.mock("../db/index", () => ({
  query: jest.fn(),
}));

jest.mock("../services/configService", () => ({
  getRequiredConfig: jest.fn((key) => {
    const mockValues = {
      HORIZON_URL: "https://horizon-testnet.stellar.org",
      ISSUER_PUBLIC: "ISSUER_PUBLIC_KEY",
    };
    return mockValues[key] || "mock-value";
  }),
  getConfig: jest.fn((key, defaultValue) => {
    return key === "STELLAR_NETWORK" ? "TESTNET" : defaultValue;
  }),
}));

const walletService = require("../services/walletService");
const {
  server,
  isValidStellarAddress,
} = require("../../blockchain/stellarService");

describe("WalletService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateAddress", () => {
    test("should validate correct Stellar public key", () => {
      const validKey =
        "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
      isValidStellarAddress.mockReturnValue(true);
      expect(walletService.validateAddress(validKey)).toBe(true);
    });

    test("should reject invalid Stellar public key", () => {
      const invalidKey = "invalid-key";
      isValidStellarAddress.mockReturnValue(false);
      expect(walletService.validateAddress(invalidKey)).toBe(false);
    });

    test("should reject null/undefined address", () => {
      isValidStellarAddress.mockReturnValue(false);
      expect(walletService.validateAddress(null)).toBe(false);
      expect(walletService.validateAddress(undefined)).toBe(false);
    });
  });

  describe("verifyWalletConnection", () => {
    const mockPublicKey =
      "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
    const mockAccount = {
      sequence: "123456789",
      balances: [
        { asset_type: "native", balance: "1000.0000000" },
        {
          asset_type: "credit_alphanum4",
          asset_code: "NOVA",
          asset_issuer: "ISSUER_PUBLIC_KEY",
          balance: "500.0000000",
          limit: "1000000.0000000",
        },
      ],
      subentry_count: 2,
      thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
      signers: [{ key: mockPublicKey, weight: 1 }],
      last_modified_ledger: 100000,
    };

    test("should successfully verify valid wallet connection", async () => {
      server.loadAccount.mockResolvedValue(mockAccount);

      const result = await walletService.verifyWalletConnection(
        mockPublicKey,
        "freighter",
      );

      expect(result.success).toBe(true);
      expect(result.wallet.publicKey).toBe(mockPublicKey);
      expect(result.wallet.walletType).toBe("freighter");
      expect(result.wallet.accountExists).toBe(true);
      expect(result.wallet.novaTrustline).toBeTruthy();
      expect(result.wallet.nativeBalance).toBe("1000.0000000");
    });

    test("should handle account not found", async () => {
      const error = new Error("Account not found");
      error.response = { status: 404 };
      server.loadAccount.mockRejectedValue(error);

      const result = await walletService.verifyWalletConnection(mockPublicKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe("account_not_found");
    });

    test("should reject invalid public key", async () => {
      const result = await walletService.verifyWalletConnection("invalid-key");

      expect(result.success).toBe(false);
      expect(result.error).toBe("verification_failed");
      expect(result.message).toBe("Invalid Stellar public key format");
    });

    test("should reject unsupported wallet type", async () => {
      const result = await walletService.verifyWalletConnection(
        mockPublicKey,
        "unsupported",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("verification_failed");
      expect(result.message).toBe("Unsupported wallet type: unsupported");
    });
  });

  describe("getBalances", () => {
    const mockPublicKey =
      "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
    const mockAccount = {
      sequence: "123456789",
      balances: [
        { asset_type: "native", balance: "1000.0000000" },
        {
          asset_type: "credit_alphanum4",
          asset_code: "NOVA",
          asset_issuer: "ISSUER_PUBLIC_KEY",
          balance: "500.0000000",
          limit: "1000000.0000000",
        },
        {
          asset_type: "credit_alphanum4",
          asset_code: "USD",
          asset_issuer: "USD_ISSUER",
          balance: "100.0000000",
          limit: "500.0000000",
        },
      ],
      last_modified_ledger: 100000,
    };

    test("should successfully retrieve balances", async () => {
      server.loadAccount.mockResolvedValue(mockAccount);

      const result = await walletService.getBalances(mockPublicKey);

      expect(result.success).toBe(true);
      expect(result.balances.native.XLM).toBe("1000.0000000");
      expect(result.balances.tokens.NOVA.balance).toBe("500.0000000");
      expect(result.balances.tokens.USD.balance).toBe("100.0000000");
      expect(result.account.publicKey).toBe(mockPublicKey);
    });

    test("should handle account not found", async () => {
      const error = new Error("Account not found");
      error.response = { status: 404 };
      server.loadAccount.mockRejectedValue(error);

      const result = await walletService.getBalances(mockPublicKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe("account_not_found");
    });
  });

  describe("submitTransaction", () => {
    const mockSignedXDR = "AAAAAgAAAABdummyXDRstring";
    const mockResult = {
      hash: "transaction-hash-123",
      ledger: 12345,
    };

    test("should successfully submit transaction", async () => {
      const mockSubmitTransaction = jest.fn().mockResolvedValue(mockResult);
      server.submitTransaction = mockSubmitTransaction;

      const metadata = {
        txType: "transfer",
        amount: "100",
        fromWallet: "from-wallet",
        toWallet: "to-wallet",
      };

      const result = await walletService.submitTransaction(
        mockSignedXDR,
        metadata,
      );

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe("transaction-hash-123");
      expect(result.ledger).toBe(12345);
      expect(result.status).toBe("submitted");
    });

    test("should handle submission failure", async () => {
      const error = new Error("Transaction failed");
      error.response = {
        data: {
          extras: {
            result_codes: {
              transaction: "tx_failed",
            },
          },
        },
      };

      const mockSubmitTransaction = jest.fn().mockRejectedValue(error);
      server.submitTransaction = mockSubmitTransaction;

      const result = await walletService.submitTransaction(mockSignedXDR);

      expect(result.success).toBe(false);
      expect(result.error).toBe("submission_failed");
      expect(result.resultCodes).toEqual({ transaction: "tx_failed" });
    });
  });

  describe("getTransactionHistory", () => {
    const mockPublicKey =
      "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
    const mockPayments = {
      records: [
        {
          id: "payment-1",
          transaction_hash: "tx-hash-1",
          type: "payment",
          from: "from-wallet",
          to: "to-wallet",
          asset_code: "NOVA",
          asset_issuer: "ISSUER_PUBLIC_KEY",
          amount: "100.0000000",
          created_at: "2024-01-01T00:00:00Z",
          ledger: 12345,
          transaction_successful: true,
        },
        {
          id: "payment-2",
          transaction_hash: "tx-hash-2",
          type: "payment",
          from: "from-wallet",
          to: "to-wallet",
          asset_type: "native",
          amount: "1.0000000",
          created_at: "2024-01-02T00:00:00Z",
          ledger: 12346,
          transaction_successful: true,
        },
      ],
      next: null,
    };

    test("should successfully retrieve transaction history", async () => {
      const mockPaymentsBuilder = {
        forAccount: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        cursor: jest.fn().mockReturnThis(),
        call: jest.fn().mockResolvedValue(mockPayments),
      };

      server.payments = jest.fn().mockReturnValue(mockPaymentsBuilder);

      const result = await walletService.getTransactionHistory(mockPublicKey, {
        limit: 100,
      });

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].asset).toBe("NOVA");
      expect(result.transactions[1].asset).toBe("XLM");
      expect(result.hasMore).toBe(false);
    });

    test("should handle account not found", async () => {
      const error = new Error("Account not found");
      error.response = { status: 404 };

      const mockPaymentsBuilder = {
        forAccount: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        call: jest.fn().mockRejectedValue(error),
      };

      server.payments = jest.fn().mockReturnValue(mockPaymentsBuilder);

      const result = await walletService.getTransactionHistory(mockPublicKey);

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(0);
    });
  });

  describe("createTrustlineTransaction", () => {
    const mockPublicKey =
      "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
    const mockAccount = {
      sequence: "123456789",
    };

    test("should successfully create trustline transaction", async () => {
      server.loadAccount.mockResolvedValue(mockAccount);
      server.fetchBaseFee.mockResolvedValue(100);

      const mockTransaction = {
        toXDR: jest.fn().mockReturnValue("trustline-xdr"),
        fee: 100,
      };

      const mockTransactionBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTransaction),
      };

      const { TransactionBuilder } = require("stellar-sdk");
      TransactionBuilder.mockImplementation(() => mockTransactionBuilder);

      const result =
        await walletService.createTrustlineTransaction(mockPublicKey);

      expect(result.success).toBe(true);
      expect(result.xdr).toBe("trustline-xdr");
      expect(result.fee).toBe(100);
    });

    test("should reject invalid public key", async () => {
      const result =
        await walletService.createTrustlineTransaction("invalid-key");

      expect(result.success).toBe(false);
      expect(result.error).toBe("trustline_creation_failed");
      expect(result.message).toBe("Invalid Stellar public key");
    });
  });

  describe("connection management", () => {
    const mockPublicKey =
      "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";

    test("should track wallet connections", async () => {
      const mockAccount = {
        sequence: "123456789",
        balances: [{ asset_type: "native", balance: "1000.0000000" }],
        subentry_count: 0,
        thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
        signers: [],
        last_modified_ledger: 100000,
      };

      server.loadAccount.mockResolvedValue(mockAccount);

      await walletService.verifyWalletConnection(mockPublicKey);

      const status = walletService.getConnectionStatus(mockPublicKey);
      expect(status).toBeTruthy();
      expect(status.publicKey).toBe(mockPublicKey);
      expect(status.connectedAt).toBeTruthy();
    });

    test("should update activity timestamp", async () => {
      const mockAccount = {
        sequence: "123456789",
        balances: [{ asset_type: "native", balance: "1000.0000000" }],
        subentry_count: 0,
        thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
        signers: [],
        last_modified_ledger: 100000,
      };

      server.loadAccount.mockResolvedValue(mockAccount);

      await walletService.verifyWalletConnection(mockPublicKey);

      const initialStatus = walletService.getConnectionStatus(mockPublicKey);
      const initialActivity = new Date(initialStatus.lastActivity);

      // Wait a bit and update activity
      await new Promise((resolve) => setTimeout(resolve, 10));
      walletService.updateActivity(mockPublicKey);

      const updatedStatus = walletService.getConnectionStatus(mockPublicKey);
      const updatedActivity = new Date(updatedStatus.lastActivity);

      expect(updatedActivity.getTime()).toBeGreaterThan(
        initialActivity.getTime(),
      );
    });

    test("should disconnect wallet", async () => {
      const mockAccount = {
        sequence: "123456789",
        balances: [{ asset_type: "native", balance: "1000.0000000" }],
        subentry_count: 0,
        thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
        signers: [],
        last_modified_ledger: 100000,
      };

      server.loadAccount.mockResolvedValue(mockAccount);

      await walletService.verifyWalletConnection(mockPublicKey);
      expect(walletService.getConnectionStatus(mockPublicKey)).toBeTruthy();

      walletService.disconnectWallet(mockPublicKey);
      expect(walletService.getConnectionStatus(mockPublicKey)).toBeNull();
    });
  });

  describe("getSupportedWallets", () => {
    test("should return list of supported wallets", () => {
      const supported = walletService.getSupportedWallets();

      expect(supported).toContain("freighter");
      expect(supported).toContain("albedo");
      expect(supported).toContain("xbull");
      expect(supported).toHaveLength(3);
    });
  });
});
