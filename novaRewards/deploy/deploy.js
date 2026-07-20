#!/usr/bin/env node
/**
 * Nova Rewards — Main Deployment Script
 *
 * Orchestrates the full deployment of the Nova Rewards token infrastructure
 * on either Stellar Testnet or Mainnet. Steps:
 *
 *   1. Validate environment
 *   2. Fund accounts (Testnet: Friendbot | Mainnet: manual pre-fund required)
 *   3. Establish NOVA trustline on Distribution Account
 *   4. Issue initial NOVA supply from Issuer to Distribution Account
 *   5. Initialize contract state
 *   6. Verify deployment health
 *
 * Each step is logged to deploy/logs/<id>.json. On failure the script exits
 * with code 1 and the log captures the failure for rollback use.
 *
 * Usage:
 *   node deploy/deploy.js                    # deploys to testnet
 *   node deploy/deploy.js --network testnet
 *   node deploy/deploy.js --network mainnet
 *   node deploy/deploy.js --dry-run          # validate env only, no tx submitted
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const {
  Keypair,
  TransactionBuilder,
  Operation,
  Memo,
  BASE_FEE,
  StrKey,
  Horizon,
  Asset,
} = require('stellar-sdk');
const readline = require('readline');

const { getNetworkConfig, resolveNetwork } = require('./config/networks');
const { Logger, Status }                   = require('./lib/logger');
const { initContract, validateEnv }        = require('./init-contract');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prompt the user for a yes/no confirmation.
 * @param {string} question
 * @returns {Promise<boolean>}
 */
function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

/**
 * Funds a Testnet account via Friendbot.
 * Skips silently if the account already exists.
 *
 * @param {string} friendbotUrl
 * @param {Horizon.Server} server
 * @param {string} publicKey
 */
async function friendbotFund(friendbotUrl, server, publicKey) {
  try {
    await server.loadAccount(publicKey);
    return { funded: false, reason: 'already_exists' };
  } catch {
    // Account does not exist — fund it
  }

  const res = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Friendbot failed for ${publicKey}: ${body}`);
  }
  return { funded: true };
}

/**
 * Checks whether an account has a NOVA trustline.
 *
 * @param {Horizon.Server} server
 * @param {string} publicKey
 * @param {Asset}  asset
 * @returns {Promise<boolean>}
 */
async function hasTrustline(server, publicKey, asset) {
  try {
    const account = await server.loadAccount(publicKey);
    return account.balances.some(
      (b) =>
        b.asset_type !== 'native' &&
        b.asset_code   === asset.code &&
        b.asset_issuer === asset.issuer
    );
  } catch {
    return false;
  }
}

/**
 * Checks whether the Distribution Account already holds NOVA tokens.
 *
 * @param {Horizon.Server} server
 * @param {string} publicKey
 * @param {Asset}  asset
 * @returns {Promise<{balance: string, hasTokens: boolean}>}
 */
async function getNovaBalance(server, publicKey, asset) {
  const account = await server.loadAccount(publicKey);
  const b = account.balances.find(
    (bal) =>
      bal.asset_type !== 'native' &&
      bal.asset_code   === asset.code &&
      bal.asset_issuer === asset.issuer
  );
  const balance = b ? b.balance : '0';
  return { balance, hasTokens: parseFloat(balance) > 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core deploy logic
// ─────────────────────────────────────────────────────────────────────────────

async function deploy({ network, dryRun = false }) {
  const cfg    = getNetworkConfig(network);
  const server = new Horizon.Server(cfg.horizonUrl);

  const issuerKeypair       = Keypair.fromSecret(process.env.ISSUER_SECRET);
  const distributionKeypair = Keypair.fromSecret(process.env.DISTRIBUTION_SECRET);
  const issuerPublic        = issuerKeypair.publicKey();
  const distributionPublic  = distributionKeypair.publicKey();
  const novaAsset           = new Asset(cfg.assetCode, issuerPublic);

  // ── Banner ─────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║   Nova Rewards Deployment — ${cfg.name.padEnd(24)}║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`  Network:      ${cfg.name}`);
  console.log(`  Horizon:      ${cfg.horizonUrl}`);
  console.log(`  Issuer:       ${issuerPublic}`);
  console.log(`  Distribution: ${distributionPublic}`);
  console.log(`  Asset:        ${cfg.assetCode}`);
  console.log(`  Supply:       ${cfg.initialSupply} ${cfg.assetCode}`);
  if (dryRun) console.log('\n  ⚠️  DRY-RUN MODE — no transactions will be submitted\n');

  // ── Mainnet confirmation guard ─────────────────────────────────────────────
  if (cfg.requireConfirm && !dryRun) {
    console.log('\n⚠️  You are about to deploy to MAINNET. This is irreversible.\n');
    const ok = await confirm('Continue with mainnet deployment?');
    if (!ok) {
      console.log('\nDeployment cancelled.\n');
      process.exit(0);
    }
  }

  // ── Start deployment log ───────────────────────────────────────────────────
  const log = Logger.begin({
    network,
    issuer:       issuerPublic,
    distribution: distributionPublic,
  });

  console.log(`\n📄  Deployment log: deploy/logs/${log.deploymentId}.json\n`);

  try {
    // ── Step 1: Environment validation ──────────────────────────────────────
    console.log('[1/6] Validating environment...');
    validateEnv(network);
    log.step({ name: 'Validate environment', status: Status.SUCCESS });

    if (dryRun) {
      log.finish('success', { dryRun: true });
      console.log('\n✅  Dry-run complete — environment is valid.\n');
      return { deploymentId: log.deploymentId, dryRun: true };
    }

    // ── Step 2: Fund accounts ───────────────────────────────────────────────
    console.log('[2/6] Funding accounts...');

    if (cfg.friendbotUrl) {
      // Testnet: use Friendbot
      const issuerResult = await friendbotFund(cfg.friendbotUrl, server, issuerPublic);
      log.step({
        name:   'Fund issuer account (Friendbot)',
        status: Status.SUCCESS,
        data:   issuerResult,
      });
      console.log(`  Issuer: ${issuerResult.funded ? 'funded via Friendbot' : 'already funded'}`);

      const distResult = await friendbotFund(cfg.friendbotUrl, server, distributionPublic);
      log.step({
        name:   'Fund distribution account (Friendbot)',
        status: Status.SUCCESS,
        data:   distResult,
      });
      console.log(`  Distribution: ${distResult.funded ? 'funded via Friendbot' : 'already funded'}`);
    } else {
      // Mainnet: verify accounts were pre-funded
      try {
        await server.loadAccount(issuerPublic);
        log.step({ name: 'Verify issuer account funded', status: Status.SUCCESS });
        console.log('  Issuer: found on mainnet ✓');
      } catch {
        const err = new Error(
          `Issuer account not found on mainnet: ${issuerPublic}\n` +
          'You must manually fund this account before deploying to mainnet.'
        );
        log.step({ name: 'Verify issuer account funded', status: Status.FAILED, error: err.message });
        throw err;
      }

      try {
        await server.loadAccount(distributionPublic);
        log.step({ name: 'Verify distribution account funded', status: Status.SUCCESS });
        console.log('  Distribution: found on mainnet ✓');
      } catch {
        const err = new Error(
          `Distribution account not found on mainnet: ${distributionPublic}\n` +
          'You must manually fund this account before deploying to mainnet.'
        );
        log.step({ name: 'Verify distribution account funded', status: Status.FAILED, error: err.message });
        throw err;
      }
    }

    // ── Step 3: Establish NOVA trustline ────────────────────────────────────
    console.log('[3/6] Establishing NOVA trustline on Distribution Account...');

    const trustlineExists = await hasTrustline(server, distributionPublic, novaAsset);

    if (trustlineExists) {
      log.step({ name: 'Establish NOVA trustline', status: Status.SKIPPED, data: { reason: 'already_exists' } });
      console.log('  Trustline already exists — skipped.');
    } else {
      const distAccount  = await server.loadAccount(distributionPublic);
      const trustlineTx  = new TransactionBuilder(distAccount, {
        fee:              String(cfg.baseFee),
        networkPassphrase: cfg.networkPassphrase,
      })
        .addOperation(Operation.changeTrust({ asset: novaAsset }))
        .setTimeout(cfg.txTimeout)
        .build();

      trustlineTx.sign(distributionKeypair);

      const trustlineResult = await server.submitTransaction(trustlineTx);
      log.step({
        name:   'Establish NOVA trustline',
        status: Status.SUCCESS,
        data:   {
          txHash:   trustlineResult.hash,
          explorer: `${cfg.explorerBase}/${trustlineResult.hash}`,
        },
      });
      log.update({ trustlineTxHash: trustlineResult.hash });
      console.log(`  Trustline created. Tx: ${trustlineResult.hash}`);
      console.log(`  Explorer: ${cfg.explorerBase}/${trustlineResult.hash}`);
    }

    // ── Step 4: Issue initial NOVA supply ───────────────────────────────────
    console.log('[4/6] Issuing initial NOVA supply...');

    const { balance: currentBalance, hasTokens } = await getNovaBalance(
      server, distributionPublic, novaAsset
    );

    if (hasTokens) {
      log.step({
        name:   'Issue initial NOVA supply',
        status: Status.SKIPPED,
        data:   { reason: 'already_funded', currentBalance },
      });
      console.log(`  Distribution already holds ${currentBalance} NOVA — skipped.`);
    } else {
      const issuerAccount = await server.loadAccount(issuerPublic);
      const paymentTx     = new TransactionBuilder(issuerAccount, {
        fee:              String(cfg.baseFee),
        networkPassphrase: cfg.networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: distributionPublic,
            asset:       novaAsset,
            amount:      cfg.initialSupply,
          })
        )
        .addMemo(Memo.text('NovaRewards initial supply'))
        .setTimeout(cfg.txTimeout)
        .build();

      paymentTx.sign(issuerKeypair);

      const paymentResult = await server.submitTransaction(paymentTx);
      log.step({
        name:   'Issue initial NOVA supply',
        status: Status.SUCCESS,
        data:   {
          amount:   cfg.initialSupply,
          txHash:   paymentResult.hash,
          explorer: `${cfg.explorerBase}/${paymentResult.hash}`,
        },
      });
      log.update({ supplyTxHash: paymentResult.hash });
      console.log(`  ${cfg.initialSupply} NOVA issued. Tx: ${paymentResult.hash}`);
      console.log(`  Explorer: ${cfg.explorerBase}/${paymentResult.hash}`);
    }

    // ── Step 5: Initialize contract state ───────────────────────────────────
    console.log('[5/6] Initializing contract state...');
    await initContract({ network, logger: log, deploymentId: log.deploymentId });

    // ── Step 6: Run inline verification ─────────────────────────────────────
    console.log('[6/6] Verifying deployment...');
    const { runVerification } = require('./verify');
    const verifyResult = await runVerification({ network, silent: false });

    if (verifyResult.allPassed) {
      log.step({ name: 'Post-deploy verification', status: Status.SUCCESS });
    } else {
      log.step({
        name:   'Post-deploy verification',
        status: Status.FAILED,
        error:  `${verifyResult.failed} check(s) failed`,
        data:   { checks: verifyResult.checks },
      });
      throw new Error(`Deployment verification failed: ${verifyResult.failed} check(s) did not pass.`);
    }

    // ── Done ─────────────────────────────────────────────────────────────────
    log.finish('success');

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   ✅  Nova Rewards deployed successfully!             ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    console.log(`  Deployment ID: ${log.deploymentId}`);
    console.log(`  Network:       ${cfg.name}`);
    console.log(`  Log:           deploy/logs/${log.deploymentId}.json`);
    console.log(`  Contract:      deploy/contract-state.json\n`);
    console.log('  Next steps:');
    console.log('    1. Start the backend:   cd backend && npm start');
    console.log('    2. Start the frontend:  cd frontend && npm run dev');
    console.log('    3. Run migrations:      npm run migrate\n');

    return { deploymentId: log.deploymentId, success: true };

  } catch (err) {
    log.finish('failed', { errorMessage: err.message });

    console.error(`\n❌  Deployment failed: ${err.message}`);
    if (err.response?.data) {
      console.error('Stellar error:', JSON.stringify(err.response.data.extras?.result_codes ?? err.response.data, null, 2));
    }
    console.error(`\n  Log saved to: deploy/logs/${log.deploymentId}.json`);
    console.error(`  To rollback:  node deploy/rollback.js --deployment-id ${log.deploymentId}\n`);

    process.exitCode = 1;
    return { deploymentId: log.deploymentId, success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ─────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const network = resolveNetwork();
  const dryRun  = process.argv.includes('--dry-run');

  try {
    validateEnv(network);
  } catch (err) {
    console.error(`\n❌  Environment error: ${err.message}\n`);
    process.exit(1);
  }

  deploy({ network, dryRun })
    .then((result) => {
      if (!result.success && !result.dryRun) process.exit(1);
    })
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}

module.exports = { deploy };
