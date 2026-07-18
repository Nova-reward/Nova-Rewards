/**
 * Network Configuration for Nova Rewards Deployment
 *
 * Defines per-network settings for Stellar Testnet and Mainnet.
 * All deployable parameters are centralized here — never hard-code
 * network details in individual scripts.
 *
 * Usage:
 *   const { getNetworkConfig } = require('./config/networks');
 *   const cfg = getNetworkConfig('testnet');
 */

'use strict';

const { Networks } = require('stellar-sdk');

/**
 * @typedef {object} NetworkConfig
 * @property {string}  name              - Human-readable network name
 * @property {string}  horizonUrl        - Horizon API base URL
 * @property {string}  networkPassphrase - Stellar network passphrase for signing
 * @property {string}  explorerBase      - Stellar explorer base URL for tx links
 * @property {string}  friendbotUrl      - Friendbot URL (null on mainnet)
 * @property {string}  assetCode         - Reward token asset code
 * @property {string}  initialSupply     - Initial NOVA supply to issue
 * @property {number}  baseFee           - Base fee in stroops (1 XLM = 10,000,000 stroops)
 * @property {number}  txTimeout         - Transaction timeout in seconds
 * @property {number}  maxFeeMultiplier  - Multiplier applied to baseFee for surge pricing
 * @property {boolean} requireConfirm    - Whether deploy requires explicit confirmation
 */

const NETWORKS = {
  testnet: {
    name:              'Stellar Testnet',
    horizonUrl:        'https://horizon-testnet.stellar.org',
    networkPassphrase: Networks.TESTNET,
    explorerBase:      'https://stellar.expert/explorer/testnet/tx',
    friendbotUrl:      'https://friendbot.stellar.org',
    assetCode:         'NOVA',
    initialSupply:     '1000000',   // 1,000,000 NOVA
    baseFee:           100,          // 100 stroops (standard)
    txTimeout:         180,          // 3 minutes
    maxFeeMultiplier:  5,
    requireConfirm:    false,        // Safe to deploy without prompt on testnet
  },

  mainnet: {
    name:              'Stellar Mainnet',
    horizonUrl:        'https://horizon.stellar.org',
    networkPassphrase: Networks.PUBLIC,
    explorerBase:      'https://stellar.expert/explorer/public/tx',
    friendbotUrl:      null,         // Friendbot is testnet-only
    assetCode:         'NOVA',
    initialSupply:     '1000000',   // 1,000,000 NOVA
    baseFee:           1000,         // Higher fee for mainnet reliability
    txTimeout:         180,
    maxFeeMultiplier:  5,
    requireConfirm:    true,         // Always prompt before mainnet deploy
  },
};

/**
 * Returns the validated configuration for the given network name.
 *
 * @param {string} network - 'testnet' | 'mainnet'
 * @returns {NetworkConfig}
 * @throws {Error} if the network name is unknown
 */
function getNetworkConfig(network) {
  const key = (network || '').toLowerCase().trim();

  if (!NETWORKS[key]) {
    throw new Error(
      `Unknown network: "${network}". Valid options are: ${Object.keys(NETWORKS).join(', ')}`
    );
  }

  return { ...NETWORKS[key] };
}

/**
 * Returns a list of all supported network names.
 * @returns {string[]}
 */
function getSupportedNetworks() {
  return Object.keys(NETWORKS);
}

/**
 * Resolves the active network from the environment or a CLI argument.
 *
 * Resolution order:
 *   1. --network=<name> or --network <name> CLI flag
 *   2. STELLAR_NETWORK environment variable
 *   3. Fallback: 'testnet'
 *
 * @param {string[]} [argv] - Defaults to process.argv
 * @returns {string} resolved network name
 */
function resolveNetwork(argv = process.argv) {
  // --network=testnet  or  --network testnet
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--network=')) {
      return argv[i].split('=')[1].toLowerCase().trim();
    }
    if (argv[i] === '--network' && argv[i + 1]) {
      return argv[i + 1].toLowerCase().trim();
    }
  }

  if (process.env.STELLAR_NETWORK) {
    return process.env.STELLAR_NETWORK.toLowerCase().trim();
  }

  return 'testnet';
}

module.exports = { getNetworkConfig, getSupportedNetworks, resolveNetwork };
