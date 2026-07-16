/**
 * merchants.js — Test merchant data generators.
 * 
 * All fixtures include RUN_SUFFIX to prevent database collisions across test runs.
 */

const RUN_ID = Date.now().toString(36);

export const MERCHANTS = {
  /**
   * Valid merchant for happy-path tests.
   */
  valid: () => ({
    name: `E2E Merchant ${RUN_ID}`,
    walletAddress: 'GCKFBEIYTKP5RCTLBMTPHBGO7NUWI6SNAJH5OVHQZAQHNOMZQR3ATYP',
    businessCategory: 'E2E Testing',
  }),

  /**
   * Merchant for campaign-specific tests.
   */
  forCampaigns: () => ({
    name: `Campaign Merchant ${RUN_ID}`,
    walletAddress: 'GBZXN7PIRZGNMHGA7MUSC7SHJFPAY2MMNVFQ4YGPHDGNDUNVCM65LLE',
    businessCategory: 'Campaign Testing',
  }),

  /**
   * Merchant for error-path tests.
   */
  forErrors: () => ({
    name: `Error Merchant ${RUN_ID}`,
    walletAddress: 'GB7EQYJRJC3X6JDQZFWYJS2JLNKBWLW42XS47FWX6X7KXXASJFX3BGVX',
    businessCategory: 'Error Testing',
  }),

  /**
   * Missing required field (for validation tests).
   */
  invalidNoName: () => ({
    walletAddress: 'GCKFBEIYTKP5RCTLBMTPHBGO7NUWI6SNAJH5OVHQZAQHNOMZQR3ATYP',
    businessCategory: 'Testing',
  }),

  /**
   * Invalid Stellar address.
   */
  invalidAddress: () => ({
    name: `Invalid Address Merchant ${RUN_ID}`,
    walletAddress: 'INVALID_ADDRESS_12345',
    businessCategory: 'Testing',
  }),
};

/**
 * Predefined valid Stellar public keys for testing.
 * These are syntactically valid Ed25519 keys (no actual funds needed).
 */
export const STELLAR_WALLETS = {
  merchant: 'GCKFBEIYTKP5RCTLBMTPHBGO7NUWI6SNAJH5OVHQZAQHNOMZQR3ATYP',
  customer1: 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K',
  customer2: 'GBYH7EWH63C7RVGVNFGXPXJCCCTUWVPCZZWJSYPSBFWKDJWZFTC5XSBM',
  customer3: 'GAWVKFXVNUMKL3YXHM2KKDQVMIWVT5LTSALP3XYQMZ7KQSGDLZ4VBZD',
};
