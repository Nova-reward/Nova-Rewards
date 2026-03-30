require('dotenv').config();
const {
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE,
} = require('stellar-sdk');
const { server, NOVA } = require('./stellarService');

/**
 * Builds an unsigned changeTrust XDR for the NOVA asset.
 * The returned XDR string is intended to be signed client-side via Freighter.
 * Requirements: 2.1
 *
 * @param {string} walletAddress - Customer's Stellar public key
 * @returns {Promise<string>} Unsigned transaction XDR
 */
async function buildTrustlineXDR(walletAddress) {
  const NETWORK_PASSPHRASE =
    process.env.STELLAR_NETWORK === 'mainnet'
      ? Networks.PUBLIC
      : Networks.TESTNET;

  const account = await server.loadAccount(walletAddress);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({
        asset: NOVA,
      })
    )
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}

/**
 * Checks whether a wallet has an active trustline for the NOVA asset
 * by querying the Horizon API.
 * Requirements: 2.3, 2.4
 *
 * @param {string} walletAddress - Stellar public key
 * @returns {Promise<{ exists: boolean }>}
 */
async function verifyTrustline(walletAddress) {
  try {
    const account = await server.loadAccount(walletAddress);
    const exists = account.balances.some(
      (b) =>
        b.asset_type !== 'native' &&
        b.asset_code === NOVA.code &&
        b.asset_issuer === NOVA.issuer
    );
    return { exists };
  } catch (err) {
    // Account not found on network — no trustline possible
    if ((err.response?.status === 404) || err.message?.toLowerCase().includes('not found')) {
      return { exists: false };
    }
    throw err;
  }
}

module.exports = { buildTrustlineXDR, verifyTrustline };
