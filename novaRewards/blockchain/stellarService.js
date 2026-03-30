require('dotenv').config();
const { Horizon, Asset, StrKey } = require('stellar-sdk');

// Shared Horizon server instance
const server = new Horizon.Server(
  process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org'
);

// NOVA asset definition — issued by the Issuer Account
const NOVA = getAsset('NOVA', process.env.ISSUER_PUBLIC);

/**
 * Validates that a string is a valid Stellar public key.
 * Must be a 56-character G-prefixed Ed25519 public key.
 * Requirements: 5.1
 *
 * @param {string} address
 * @returns {boolean}
 */
function isValidStellarAddress(address) {
  if (typeof address !== 'string') return false;
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/**
 * Returns a Stellar Asset object.
 * Returns Asset.native() if code is 'XLM', otherwise returns a non-native Asset.
 *
 * @param {string} code - Asset code (e.g. 'NOVA', 'XLM')
 * @param {string} [issuer] - Asset issuer public key (optional for XLM)
 * @returns {Asset}
 */
function getAsset(code, issuer) {
  if (code === 'XLM' || code === 'native') {
    return Asset.native();
  }
  return new Asset(code, issuer);
}


/**
 * Queries Horizon for the account's current NOVA token balance.
 * Returns '0' if the account has no trustline for NOVA.
 * Requirements: 6.1, 8.3
 *
 * @param {string} walletAddress - Stellar public key
 * @returns {Promise<string>} NOVA balance as a string (e.g. "100.0000000")
 */
async function getNOVABalance(walletAddress) {\n  try {\n    const account = await server.loadAccount(walletAddress);\n    const novaBalance = account.balances.find(\n      (b) =>\n        b.asset_type !== 'native' &&\n        b.asset_code === 'NOVA' &&\n        b.asset_issuer === process.env.ISSUER_PUBLIC\n    );\n    return novaBalance ? novaBalance.balance : '0';\n  } catch (err) {\n    if ((err.response?.status === 404) || err.message?.toLowerCase().includes('not found')) {\n      return '0';\n    }\n    throw err;\n  }\n}


module.exports = { server, NOVA, isValidStellarAddress, getNOVABalance, getAsset };
