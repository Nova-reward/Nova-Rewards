const {
  server,
  NOVA,
  isValidStellarAddress,
  getNOVABalance,
} = require("../../blockchain/stellarService");
const {
  Horizon,
  Asset,
  StrKey,
  Networks,
  TransactionBuilder,
  Operation,
} = require("stellar-sdk");
const { getRequiredConfig, getConfig } = require("./configService");
const { getUserByWallet, createUser } = require("../db/userRepository");
const { recordTransaction } = require("../db/transactionRepository");
const { query } = require("../db/index");

const HORIZON_URL = getRequiredConfig("HORIZON_URL");
const NETWORK_PASSPHRASE =
  getConfig("STELLAR_NETWORK", "TESTNET") === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;
const ISSUER_PUBLIC = getRequiredConfig("ISSUER_PUBLIC");

/**
 * Wallet Integration Service
 * Provides comprehensive wallet functionality including:
 * - Wallet connection verification
 * - Balance retrieval
 * - Transaction submission and tracking
 * - Multi-wallet support
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

class WalletService {
  constructor() {
    this.supportedWallets = ["freighter", "albedo", "xbull"];
    this.walletConnections = new Map(); // Track active connections
  }

  /**
   * Validates a Stellar public key format
   * @param {string} address - Stellar public key to validate
   * @returns {boolean} True if valid
   */
  validateAddress(address) {
    return isValidStellarAddress(address);
  }

  /**
   * Verifies wallet connection and returns wallet info
   * @param {string} publicKey - Wallet public key
   * @param {string} walletType - Type of wallet (freighter, albedo, etc.)
   * @returns {Promise<Object>} Wallet verification result
   */
  async verifyWalletConnection(publicKey, walletType = "freighter") {
    try {
      if (!this.validateAddress(publicKey)) {
        throw new Error("Invalid Stellar public key format");
      }

      if (!this.supportedWallets.includes(walletType)) {
        throw new Error(`Unsupported wallet type: ${walletType}`);
      }

      // Verify account exists on Stellar network
      const account = await server.loadAccount(publicKey);

      // Check if account has required trustlines for NOVA
      const novaTrustline = account.balances.find(
        (balance) =>
          balance.asset_type !== "native" &&
          balance.asset_code === "NOVA" &&
          balance.asset_issuer === ISSUER_PUBLIC,
      );

      const walletInfo = {
        publicKey,
        walletType,
        accountExists: true,
        sequence: account.sequence,
        novaTrustline: novaTrustline
          ? {
              balance: novaTrustline.balance,
              limit: novaTrustline.limit,
              issuer: novaTrustline.asset_issuer,
            }
          : null,
        nativeBalance:
          account.balances.find((b) => b.asset_type === "native")?.balance ||
          "0",
        subentries: account.subentry_count,
        thresholds: account.thresholds,
        signers: account.signers,
        lastModified: account.last_modified_ledger,
      };

      // Store connection info
      this.walletConnections.set(publicKey, {
        ...walletInfo,
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      });

      return {
        success: true,
        wallet: walletInfo,
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: false,
          error: "account_not_found",
          message: "Account not found on Stellar network",
        };
      }

      return {
        success: false,
        error: "verification_failed",
        message: error.message,
      };
    }
  }

  /**
   * Retrieves comprehensive balance information for a wallet
   * @param {string} publicKey - Wallet public key
   * @returns {Promise<Object>} Balance information
   */
  async getBalances(publicKey) {
    try {
      if (!this.validateAddress(publicKey)) {
        throw new Error("Invalid Stellar public key");
      }

      const account = await server.loadAccount(publicKey);
      const balances = {
        native: {
          XLM:
            account.balances.find((b) => b.asset_type === "native")?.balance ||
            "0",
        },
        tokens: {},
      };

      // Process all non-native balances
      account.balances.forEach((balance) => {
        if (balance.asset_type !== "native") {
          balances.tokens[balance.asset_code] = {
            balance: balance.balance,
            limit: balance.limit,
            issuer: balance.asset_issuer,
            asset_type: balance.asset_type,
          };
        }
      });

      return {
        success: true,
        balances,
        account: {
          publicKey,
          sequence: account.sequence,
          lastModified: account.last_modified_ledger,
        },
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: false,
          error: "account_not_found",
          message: "Account not found on Stellar network",
        };
      }

      return {
        success: false,
        error: "balance_fetch_failed",
        message: error.message,
      };
    }
  }

  /**
   * Submits a signed transaction to the Stellar network
   * @param {string} signedXDR - Signed transaction XDR
   * @param {Object} metadata - Transaction metadata
   * @returns {Promise<Object>} Submission result
   */
  async submitTransaction(signedXDR, metadata = {}) {
    try {
      const transaction = new Transaction(signedXDR, NETWORK_PASSPHRASE);

      // Submit to Horizon
      const result = await server.submitTransaction(transaction);

      // Record transaction in database
      if (metadata.recordInDb !== false) {
        await this.recordTransactionSubmission(result, metadata);
      }

      // Start transaction confirmation tracking
      this.trackTransactionConfirmation(result.hash, metadata);

      return {
        success: true,
        transactionHash: result.hash,
        ledger: result.ledger,
        status: "submitted",
        message: "Transaction submitted successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: "submission_failed",
        message: error.message,
        resultCodes: error.response?.data?.extras?.result_codes,
      };
    }
  }

  /**
   * Tracks transaction confirmation status
   * @param {string} transactionHash - Transaction hash to track
   * @param {Object} metadata - Transaction metadata
   */
  async trackTransactionConfirmation(transactionHash, metadata = {}) {
    const maxAttempts = 30; // 30 attempts with 10 second intervals = 5 minutes
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const transaction = await server
          .transactions()
          .transaction(transactionHash)
          .call();

        if (transaction.successful) {
          await this.updateTransactionStatus(
            transactionHash,
            "confirmed",
            transaction,
          );
          return true;
        } else if (transaction.result_xdr) {
          await this.updateTransactionStatus(
            transactionHash,
            "failed",
            transaction,
          );
          return true;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 10000); // Check every 10 seconds
        } else {
          await this.updateTransactionStatus(transactionHash, "timeout", null);
        }

        return false;
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 10000);
        } else {
          await this.updateTransactionStatus(transactionHash, "timeout", null);
        }
        return false;
      }
    };

    // Start tracking
    setTimeout(checkStatus, 5000); // First check after 5 seconds
  }

  /**
   * Records transaction submission in database
   * @param {Object} result - Horizon submission result
   * @param {Object} metadata - Transaction metadata
   */
  async recordTransactionSubmission(result, metadata) {
    try {
      const transactionData = {
        txHash: result.hash,
        txType: metadata.txType || "transfer",
        amount: metadata.amount,
        fromWallet: metadata.fromWallet,
        toWallet: metadata.toWallet,
        merchantId: metadata.merchantId,
        campaignId: metadata.campaignId,
        status: "submitted",
        ledger: result.ledger,
        createdAt: new Date(),
      };

      await recordTransaction(transactionData);
    } catch (error) {
      console.error("Failed to record transaction:", error);
    }
  }

  /**
   * Updates transaction status in database
   * @param {string} transactionHash - Transaction hash
   * @param {string} status - New status
   * @param {Object} transaction - Horizon transaction data
   */
  async updateTransactionStatus(transactionHash, status, transaction) {
    try {
      const updateData = {
        status,
        confirmedAt: status === "confirmed" ? new Date() : null,
        failedAt: status === "failed" ? new Date() : null,
        ledger: transaction?.ledger,
        resultXdr: transaction?.result_xdr,
      };

      await query(
        "UPDATE transactions SET status = $1, confirmed_at = $2, failed_at = $3, ledger = $4, result_xdr = $5 WHERE tx_hash = $6",
        [
          updateData.status,
          updateData.confirmedAt,
          updateData.failedAt,
          updateData.ledger,
          updateData.resultXdr,
          transactionHash,
        ],
      );
    } catch (error) {
      console.error("Failed to update transaction status:", error);
    }
  }

  /**
   * Gets transaction history for a wallet
   * @param {string} publicKey - Wallet public key
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Transaction history
   */
  async getTransactionHistory(publicKey, options = {}) {
    try {
      if (!this.validateAddress(publicKey)) {
        throw new Error("Invalid Stellar public key");
      }

      const limit = options.limit || 100;
      const cursor = options.cursor;

      let paymentsBuilder = server
        .payments()
        .forAccount(publicKey)
        .order("desc")
        .limit(limit);

      if (cursor) {
        paymentsBuilder = paymentsBuilder.cursor(cursor);
      }

      const payments = await paymentsBuilder.call();

      // Filter for NOVA transactions and add metadata
      const novaTransactions = payments.records
        .filter(
          (record) =>
            record.type === "payment" &&
            ((record.asset_code === "NOVA" &&
              record.asset_issuer === ISSUER_PUBLIC) ||
              record.asset_type === "native"),
        )
        .map((record) => ({
          id: record.id,
          hash: record.transaction_hash,
          type: record.type,
          from: record.from,
          to: record.to,
          asset: record.asset_code || "XLM",
          assetIssuer: record.asset_issuer,
          amount: record.amount,
          memo: record.memo,
          memoType: record.memo_type,
          createdAt: record.created_at,
          ledger: record.ledger,
          successful: record.transaction_successful,
        }));

      return {
        success: true,
        transactions: novaTransactions,
        cursor: payments.next ? payments.next.cursor : null,
        hasMore: payments.records.length === limit,
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          success: true,
          transactions: [],
          cursor: null,
          hasMore: false,
        };
      }

      return {
        success: false,
        error: "history_fetch_failed",
        message: error.message,
      };
    }
  }

  /**
   * Creates a trustline transaction for NOVA token
   * @param {string} publicKey - Wallet public key
   * @param {string} limit - Trustline limit (default: max uint64)
   * @returns {Promise<Object>} Trustline transaction XDR
   */
  async createTrustlineTransaction(publicKey, limit = "9223372036854775807") {
    try {
      if (!this.validateAddress(publicKey)) {
        throw new Error("Invalid Stellar public key");
      }

      const account = await server.loadAccount(publicKey);

      const transaction = new TransactionBuilder(account, {
        fee: await server.fetchBaseFee(),
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          Operation.changeTrust({
            asset: NOVA,
            limit: limit,
          }),
        )
        .setTimeout(30)
        .build();

      return {
        success: true,
        xdr: transaction.toXDR(),
        fee: transaction.fee,
      };
    } catch (error) {
      return {
        success: false,
        error: "trustline_creation_failed",
        message: error.message,
      };
    }
  }

  /**
   * Gets wallet connection status
   * @param {string} publicKey - Wallet public key
   * @returns {Object|null} Connection info
   */
  getConnectionStatus(publicKey) {
    return this.walletConnections.get(publicKey) || null;
  }

  /**
   * Updates wallet activity timestamp
   * @param {string} publicKey - Wallet public key
   */
  updateActivity(publicKey) {
    const connection = this.walletConnections.get(publicKey);
    if (connection) {
      connection.lastActivity = new Date().toISOString();
      this.walletConnections.set(publicKey, connection);
    }
  }

  /**
   * Disconnects wallet and cleans up connection data
   * @param {string} publicKey - Wallet public key
   */
  disconnectWallet(publicKey) {
    this.walletConnections.delete(publicKey);
  }

  /**
   * Gets list of supported wallets
   * @returns {string[]} Array of supported wallet types
   */
  getSupportedWallets() {
    return [...this.supportedWallets];
  }
}

module.exports = new WalletService();
