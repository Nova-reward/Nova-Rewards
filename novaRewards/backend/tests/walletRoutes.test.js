const request = require("supertest");
const express = require("express");
const walletRoutes = require("../routes/wallet");
const walletService = require("../services/walletService");

// Mock wallet service
jest.mock("../services/walletService");

// Mock authentication middleware
jest.mock("../middleware/authenticateUser", () => {
  return (req, res, next) => {
    req.user = { id: 1, email: "test@example.com" };
    next();
  };
});

// Create a test app to avoid importing the main server
const app = express();
app.use(express.json());
app.use("/api/wallet", walletRoutes);

describe("Wallet Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/wallet/supported", () => {
    test("should return list of supported wallets", async () => {
      const mockWallets = ["freighter", "albedo", "xbull"];
      walletService.getSupportedWallets.mockReturnValue(mockWallets);

      const response = await request(app)
        .get("/api/wallet/supported")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.wallets).toEqual(mockWallets);
    });
  });

  describe("POST /api/wallet/verify", () => {
    test("should verify wallet connection successfully", async () => {
      const mockResult = {
        success: true,
        wallet: {
          publicKey:
            "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ",
          walletType: "freighter",
          accountExists: true,
        },
      };

      walletService.verifyWalletConnection.mockResolvedValue(mockResult);

      const response = await request(app)
        .post("/api/wallet/verify")
        .send({
          publicKey:
            "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ",
          walletType: "freighter",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.wallet.publicKey).toBe(
        "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ",
      );
      expect(walletService.verifyWalletConnection).toHaveBeenCalledWith(
        "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ",
        "freighter",
      );
    });

    test("should return 400 when publicKey is missing", async () => {
      const response = await request(app)
        .post("/api/wallet/verify")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("validation_error");
      expect(response.body.message).toBe("publicKey is required");
    });

    test("should return 400 when wallet verification fails", async () => {
      const mockResult = {
        success: false,
        error: "account_not_found",
        message: "Account not found on Stellar network",
      };

      walletService.verifyWalletConnection.mockResolvedValue(mockResult);

      const response = await request(app)
        .post("/api/wallet/verify")
        .send({
          publicKey:
            "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("account_not_found");
    });
  });

  describe("GET /api/wallet/balances/:publicKey", () => {
    test("should get wallet balances successfully", async () => {
      const mockResult = {
        success: true,
        balances: {
          native: { XLM: "1000.0000000" },
          tokens: { NOVA: { balance: "500.0000000" } },
        },
      };

      walletService.getBalances.mockResolvedValue(mockResult);

      const publicKey =
        "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
      const response = await request(app)
        .get(`/api/wallet/balances/${publicKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.balances.native.XLM).toBe("1000.0000000");
      expect(walletService.getBalances).toHaveBeenCalledWith(publicKey);
    });

    test("should return 400 when balance fetch fails", async () => {
      const mockResult = {
        success: false,
        error: "account_not_found",
        message: "Account not found on Stellar network",
      };

      walletService.getBalances.mockResolvedValue(mockResult);

      const publicKey =
        "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
      const response = await request(app)
        .get(`/api/wallet/balances/${publicKey}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("account_not_found");
    });
  });

  describe("POST /api/wallet/submit", () => {
    const mockSignedXDR = "AAAAAgAAAABdummyXDRstring";

    test("should submit transaction successfully", async () => {
      const mockResult = {
        success: true,
        transactionHash: "tx-hash-123",
        ledger: 12345,
        status: "submitted",
      };

      walletService.submitTransaction.mockResolvedValue(mockResult);

      const response = await request(app)
        .post("/api/wallet/submit")
        .set("Authorization", "Bearer fake-token")
        .send({
          signedXDR: mockSignedXDR,
          metadata: { txType: "transfer" },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transactionHash).toBe("tx-hash-123");
      expect(walletService.submitTransaction).toHaveBeenCalledWith(
        mockSignedXDR,
        { txType: "transfer" },
      );
    });

    test("should return 400 when signedXDR is missing", async () => {
      const response = await request(app)
        .post("/api/wallet/submit")
        .set("Authorization", "Bearer fake-token")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("validation_error");
      expect(response.body.message).toBe("signedXDR is required");
    });

    test("should return 400 when transaction submission fails", async () => {
      const mockResult = {
        success: false,
        error: "submission_failed",
        message: "Transaction failed",
      };

      walletService.submitTransaction.mockResolvedValue(mockResult);

      const response = await request(app)
        .post("/api/wallet/submit")
        .set("Authorization", "Bearer fake-token")
        .send({
          signedXDR: mockSignedXDR,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("submission_failed");
    });
  });

  describe("GET /api/wallet/history/:publicKey", () => {
    test("should get transaction history successfully", async () => {
      const mockResult = {
        success: true,
        transactions: [
          {
            id: "payment-1",
            hash: "tx-hash-1",
            asset: "NOVA",
            amount: "100.0000000",
          },
        ],
        cursor: null,
        hasMore: false,
      };

      walletService.getTransactionHistory.mockResolvedValue(mockResult);

      const publicKey =
        "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
      const response = await request(app)
        .get(`/api/wallet/history/${publicKey}`)
        .query({ limit: 50 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transactions).toHaveLength(1);
      expect(walletService.getTransactionHistory).toHaveBeenCalledWith(
        publicKey,
        { limit: 50, cursor: undefined },
      );
    });

    test("should return 400 when history fetch fails", async () => {
      const mockResult = {
        success: false,
        error: "history_fetch_failed",
        message: "Failed to fetch history",
      };

      walletService.getTransactionHistory.mockResolvedValue(mockResult);

      const publicKey =
        "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
      const response = await request(app)
        .get(`/api/wallet/history/${publicKey}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("history_fetch_failed");
    });
  });

  describe("POST /api/wallet/trustline", () => {
    test("should create trustline transaction successfully", async () => {
      const mockResult = {
        success: true,
        xdr: "trustline-xdr",
        fee: 100,
      };

      walletService.createTrustlineTransaction.mockResolvedValue(mockResult);

      const response = await request(app)
        .post("/api/wallet/trustline")
        .set("Authorization", "Bearer fake-token")
        .send({
          publicKey:
            "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ",
          limit: "1000000",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.xdr).toBe("trustline-xdr");
      expect(walletService.createTrustlineTransaction).toHaveBeenCalledWith(
        "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ",
        "1000000",
      );
    });

    test("should return 400 when publicKey is missing", async () => {
      const response = await request(app)
        .post("/api/wallet/trustline")
        .set("Authorization", "Bearer fake-token")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("validation_error");
      expect(response.body.message).toBe("publicKey is required");
    });
  });

  describe("GET /api/wallet/status/:publicKey", () => {
    test("should return connected status when wallet is connected", async () => {
      const mockConnection = {
        publicKey: "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ",
        connectedAt: "2024-01-01T00:00:00.000Z",
        lastActivity: "2024-01-01T00:00:00.000Z",
      };

      walletService.getConnectionStatus.mockReturnValue(mockConnection);

      const publicKey =
        "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
      const response = await request(app)
        .get(`/api/wallet/status/${publicKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe("connected");
      expect(response.body.connection).toEqual(mockConnection);
    });

    test("should return not_connected status when wallet is not connected", async () => {
      walletService.getConnectionStatus.mockReturnValue(null);

      const publicKey =
        "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
      const response = await request(app)
        .get(`/api/wallet/status/${publicKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe("not_connected");
      expect(response.body.connection).toBeNull();
    });
  });

  describe("POST /api/wallet/validate", () => {
    test("should validate correct address", async () => {
      const validAddress =
        "GD5WDJQZ4JX7NQKMWVKFPQVQNBQ5LWY3YH7M3KZLJQJX7NQKMWVKFPQVQ";
      walletService.validateAddress.mockReturnValue(true);

      const response = await request(app)
        .post("/api/wallet/validate")
        .send({ address: validAddress })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
      expect(response.body.address).toBe(validAddress);
    });

    test("should return 400 when address is missing", async () => {
      const response = await request(app)
        .post("/api/wallet/validate")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("validation_error");
      expect(response.body.message).toBe("address is required");
    });

    test("should validate invalid address", async () => {
      const invalidAddress = "invalid-address";
      walletService.validateAddress.mockReturnValue(false);

      const response = await request(app)
        .post("/api/wallet/validate")
        .send({ address: invalidAddress })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(false);
    });
  });
});
