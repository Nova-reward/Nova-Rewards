/**
 * Transaction API utilities
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const transactionAPI = {
  /**
   * Fetch paginated transactions
   */
  async getTransactions(userId, filters = {}) {
    const params = new URLSearchParams({
      userId,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
      ...(filters.type && { type: filters.type }),
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
      ...(filters.campaignId && { campaignId: filters.campaignId }),
    });

    const response = await fetch(`${API_BASE_URL}/transactions?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Export all transactions as CSV
   */
  async exportTransactionsCSV(userId, filters = {}) {
    const params = new URLSearchParams({
      userId,
      limit: 10000, // Export limit
      offset: 0,
      ...(filters.type && { type: filters.type }),
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
      ...(filters.campaignId && { campaignId: filters.campaignId }),
    });

    const response = await fetch(`${API_BASE_URL}/transactions/export/csv?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to export transactions: ${response.statusText}`);
    }
    return response.blob();
  },

  /**
   * Get transaction details by ID
   */
  async getTransactionById(transactionId) {
    const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Verify transaction on Stellar blockchain
   */
  async verifyTransaction(txHash) {
    try {
      const response = await fetch(
        `https://stellar.expert/api/v2/tx/${txHash}`
      );
      if (!response.ok) {
        throw new Error('Transaction not found');
      }
      return response.json();
    } catch (error) {
      return null;
    }
  },

  /**
   * Get transaction statistics
   */
  async getTransactionStats(userId, filters = {}) {
    const params = new URLSearchParams({
      userId,
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
    });

    const response = await fetch(`${API_BASE_URL}/transactions/stats?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.statusText}`);
    }
    return response.json();
  },
};

export default transactionAPI;
