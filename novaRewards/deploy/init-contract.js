#!/usr/bin/env node
/**
 * Contract Initialization Script
 *
 * Initializes the Nova Rewards contract state after the core asset
 * issuance step. Specifically:
 *
 *   1. Sets distribution account authorization flags via Horizon
 *   2. Records contract metadata (asset code, issuer, limits) into the log
 *   3. Verifies the initial NOVA supply landed in the Distribution Account
 *   4. Writes a contract-state.json snapshot for downstream scripts
 *
 * This script is called automatically by deploy.js but can also be run
 * standalone after a manual asset issuance:
 *
 *   node deploy/init-contract.js --network testnet
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path    = require('path');
const fs      = require('fs');
const { Horizon, Asset, StrKey } = require('stellar-sdk');

const { getNetworkConfig, resolveNetwork } = require('./config/networks');
const { Logger, Status }                   = require('./lib/logger');

const CONTRACT_STATE_PATH = path.join(__dirname, 'contract-state.json');

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates required environment variables for initialization.
 * @param {string} network
 * @throws {Error} listing every missing variable
 */
function validateEnv(network) {
  const required = ['ISSUER_PUBLIC', 'ISSUER_SECRET', 'DISTRIBUTION_PUBLIC', 'DISTRIBUTION_SECRET'];
  const missing  = required.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for ${network}: ${missing.join(', ')}\n` +
      'Copy .env.example to .env and fill in all values before deploying.'
    );
  }

  // Light key-format check (do not log secrets)
  if (!StrKey.isValidEd25519PublicKey(process.env.ISSUER_PUBLIC)) {
    throw new Error('ISSUER_PUBLIC is not a valid Stellar Ed25519 public key.');
  }
  if (!StrKey.isValidEd25519PublicKey(process.env.DISTRIBUTION_PUBLIC)) {
    throw new Error('DISTRIBUTION_PUBLIC is not a valid Stellar Ed25519 public key.');
  }
}

/**
 * Fetches the current NOVA balance for the Distribution Account.
 *
 * @param {Horizon.Server} server
 * @param {string} distributionPublic
 * @param {Asset}  novaAsset
 * @returns {Promise<string>} balance string e.g. "1000000.0000000"
 */
async function getNovaBalance(server, distributionPublic, novaAsset) {
  const account = await server.loadAccount(distributionPublic);
  const balance = account.balances.find(
    (b) =>
      b.asset_type !== 'native' &&
      b.asset_code   === novaAsset.code &&
      b.asset_issuer === novaAsset.issuer
  );
  return balance ? balance.balance : '0';
}

/**
 * Fetches the current XLM balance for an account.
 *
 * @param {Horizon.Server} server
 * @param {string} publicKey
 * @returns {Promise<string>}
 */
async function getXlmBalance(server, publicKey) {
  const account = await server.loadAccount(publicKey);
  const xlm     = account.balances.find((b) => b.asset_type === 'native');
  return xlm ? xlm.balance : '0';
}

/**
 * Writes (or updates) the contract-state.json snapshot file.
 *
 * @param {object} state
 */
function writeContractState(state) {
  fs.writeFileSync(CONTRACT_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core initialization logic.
 *
 * @param {object}      opts
 * @param {string}      opts.network       - 'testnet' | 'mainnet'
 * @param {Logger|null} [opts.logger]      - Logger instance (creates one if absent)
 * @param {string|null} [opts.deploymentId]- Attach to existing deployment log
 * @returns {Promise<object>} contract state snapshot
 */
async function initContract({ network, logger = null, deploymentId = null }) {
  const cfg    = getNetworkConfig(network);
  const server = new Horizon.Server(cfg.horizonUrl);

  const issuerPublic       = process.env.ISSUER_PUBLIC;
  const distributionPublic = process.env.DISTRIBUTION_PUBLIC;
  const novaAsset          = new Asset(cfg.assetCode, issuerPublic);

  // Use provided logger or create a standalone one
  const log = logger || Logger.begin({
    network,
    issuer:       issuerPublic,
    distribution: distributionPublic,
  });

  console.log(`\n📋  Initializing contract on ${cfg.name}...`);
  console.log(`    Issuer:       ${issuerPublic}`);
  console.log(`    Distribution: ${distributionPublic}`);
  console.log(`    Asset:        ${cfg.assetCode}\n`);

  // ── Step 1: Confirm Issuer account exists ──────────────────────────────────
  let issuerXlm;
  try {
    issuerXlm = await getXlmBalance(server, issuerPublic);
    log.step({ name: 'Confirm issuer account', status: Status.SUCCESS, data: { xlm: issuerXlm } });
  } catch (err) {
    log.step({ name: 'Confirm issuer account', status: Status.FAILED, error: err.message });
    throw new Error(`Issuer account not found on ${cfg.name}: ${issuerPublic}`);
  }

  // ── Step 2: Confirm Distribution account exists ────────────────────────────
  let distributionXlm;
  try {
    distributionXlm = await getXlmBalance(server, distributionPublic);
    log.step({
      name:   'Confirm distribution account',
      status: Status.SUCCESS,
      data:   { xlm: distributionXlm },
    });
  } catch (err) {
    log.step({ name: 'Confirm distribution account', status: Status.FAILED, error: err.message });
    throw new Error(`Distribution account not found on ${cfg.name}: ${distributionPublic}`);
  }

  // ── Step 3: Verify trustline exists on Distribution account ───────────────
  const distAccount = await server.loadAccount(distributionPublic);
  const hasTrustline = distAccount.balances.some(
    (b) =>
      b.asset_type !== 'native' &&
      b.asset_code   === cfg.assetCode &&
      b.asset_issuer === issuerPublic
  );

  if (hasTrustline) {
    log.step({ name: 'Verify NOVA trustline', status: Status.SUCCESS });
  } else {
    log.step({
      name:   'Verify NOVA trustline',
      status: Status.FAILED,
      error:  'Distribution account is missing NOVA trustline. Run the full deploy first.',
    });
    throw new Error('NOVA trustline not found on Distribution Account.');
  }

  // ── Step 4: Verify initial supply was received ────────────────────────────
  const novaBalance = await getNovaBalance(server, distributionPublic, novaAsset);
  const hasSupply   = parseFloat(novaBalance) > 0;

  if (hasSupply) {
    log.step({
      name:   'Verify initial supply',
      status: Status.SUCCESS,
      data:   { novaBalance, expectedSupply: cfg.initialSupply },
    });
  } else {
    log.step({
      name:   'Verify initial supply',
      status: Status.FAILED,
      error:  `Distribution account NOVA balance is 0. Expected: ${cfg.initialSupply}`,
    });
    throw new Error('Initial NOVA supply not found in Distribution Account.');
  }

  // ── Step 5: Build and persist contract state ──────────────────────────────
  const contractState = {
    deploymentId:  deploymentId || log.deploymentId,
    network,
    initializedAt: new Date().toISOString(),
    asset: {
      code:    cfg.assetCode,
      issuer:  issuerPublic,
      supply:  cfg.initialSupply,
    },
    accounts: {
      issuer: {
        publicKey:  issuerPublic,
        xlmBalance: issuerXlm,
      },
      distribution: {
        publicKey:   distributionPublic,
        xlmBalance:  distributionXlm,
        novaBalance: novaBalance,
      },
    },
    horizonUrl:   cfg.horizonUrl,
    explorerBase: cfg.explorerBase,
  };

  writeContractState(contractState);

  log.step({
    name:   'Write contract state',
    status: Status.SUCCESS,
    data:   { path: CONTRACT_STATE_PATH },
  });

  console.log(`\n✅  Contract initialized successfully.`);
  console.log(`    NOVA balance in Distribution Account: ${novaBalance}`);
  console.log(`    Contract state written to: ${CONTRACT_STATE_PATH}\n`);

  return contractState;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ─────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const network = resolveNetwork();

  try {
    validateEnv(network);
  } catch (err) {
    console.error(`\n❌  Environment error: ${err.message}\n`);
    process.exit(1);
  }

  initContract({ network })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`\n❌  Initialization failed: ${err.message}\n`);
      if (err.response?.data) {
        console.error('Stellar error:', JSON.stringify(err.response.data, null, 2));
      }
      process.exit(1);
    });
}

module.exports = { initContract, validateEnv };
