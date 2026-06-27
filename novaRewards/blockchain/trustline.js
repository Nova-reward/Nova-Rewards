require('dotenv').config();
const {
  TransactionBuilder,
  Operation,
  Asset,
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

/**
 * Checks whether a wallet has an active trustline for any Stellar asset.
 * Accepts explicit assetCode + issuer so it works beyond just NOVA.
 * Requirements: #661
 *
 * @param {string} accountId  - Stellar public key
 * @param {string} assetCode  - Asset code, e.g. "NOVA"
 * @param {string} issuer     - Asset issuer public key
 * @returns {Promise<{ exists: boolean }>}
 */
async function checkTrustline(accountId, assetCode, issuer) {
  try {
    const account = await server.loadAccount(accountId);
    const exists = account.balances.some(
      (b) =>
        b.asset_type !== 'native' &&
        b.asset_code === assetCode &&
        b.asset_issuer === issuer
    );
    return { exists };
  } catch (err) {
    if ((err.response?.status === 404) || err.message?.toLowerCase().includes('not found')) {
      return { exists: false };
    }
    throw err;
  }
}

/**
 * Builds an unsigned changeTrust XDR for an arbitrary Stellar asset.
 * The caller is responsible for signing and submitting the returned XDR.
 * Returns an error message when the account has insufficient XLM (< 1.5 XLM
 * base reserve + 0.5 XLM per trustline).
 * Requirements: #661
 *
 * @param {{ walletAddress: string, assetCode: string, issuer: string }} params
 * @returns {Promise<{ xdr: string }>}
 * @throws {Error} if the account has insufficient XLM balance
 */
async function establishTrustline({ walletAddress, assetCode, issuer }) {
  const NETWORK_PASSPHRASE =
    process.env.STELLAR_NETWORK === 'mainnet'
      ? Networks.PUBLIC
      : Networks.TESTNET;

  const account = await server.loadAccount(walletAddress);

  // Guard: each trustline requires 0.5 XLM base reserve.
  const nativeBalance = account.balances.find((b) => b.asset_type === 'native');
  const xlmBalance = parseFloat(nativeBalance?.balance ?? '0');
  if (xlmBalance < 1.5) {
    throw new Error(
      `Insufficient XLM balance (${xlmBalance} XLM). At least 1.5 XLM is required to establish a trustline.`
    );
  }

  const asset = new Asset(assetCode, issuer);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(180)
    .build();

  return { xdr: transaction.toXDR() };
}

module.exports = { buildTrustlineXDR, verifyTrustline, checkTrustline, establishTrustline };
