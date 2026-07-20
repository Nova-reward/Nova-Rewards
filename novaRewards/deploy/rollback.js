#!/usr/bin/env node
/**
 * Rollback Script
 *
 * Attempts to reverse the effects of a Nova Rewards deployment as much as
 * the Stellar network permits. Because Stellar is a live ledger, "rollback"
 * cannot delete accounts or transactions — it instead:
 *
 *   1. Burns remaining NOVA tokens (Distribution → Issuer)
 *   2. Removes the NOVA trustline from the Distribution Account
 *   3. Clears the contract-state.json snapshot
 *   4. Marks the deployment log as rolled_back
 *
 * Usage:
 *   node deploy/rollback.js                          # latest testnet deploy
 *   node deploy/rollback.js --network mainnet
 *   node deploy/rollback.js --deployment-id <id>
 *   node deploy/rollback.js --dry-run                # show plan, no txs
 *
 * Exit codes:
 *   0 — rollback completed (or dry-run)
 *   1 — rollback failed
 *   2 — nothing to roll back / log not found
 *
 * ⚠️  NOTE: Account creation on Stellar is irreversible. Rollback cannot
 *    undo Friendbot funding or reclaim on-chain accounts. It only reverses
 *    asset-level state (trustlines and balances).
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs   = require('fs');
const readline = require('readline');

const {
  Keypair,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Horizon,
  Asset,
} = require('stellar-sdk');

const { getNetworkConfig, resolveNetwork } = require('./config/networks');
const { Logger, Status }                   = require('./lib/logger');

const CONTRACT_STATE_PATH = path.join(__dirname, 'contract-state.json');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prompt for yes/no confirmation.
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
 * Fetches NOVA balance for an account.
 * @returns {Promise<{balance: string, raw: object|null}>}
 */
async function getNovaBalance(server, publicKey, asset) {
  try {
    const account  = await server.loadAccount(publicKey);
    const novaEntry = account.balances.find(
      (b) =>
        b.asset_type !== 'native' &&
        b.asset_code   === asset.code &&
        b.asset_issuer === asset.issuer
    );
    return {
      balance:      novaEntry ? novaEntry.balance : '0',
      hasTrustline: !!novaEntry,
    };
  } catch {
    return { balance: '0', hasTrustline: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core rollback logic
// ─────────────────────────────────────────────────────────────────────────────

async function rollback({ network, deploymentId = null, dryRun = false }) {
  const cfg    = getNetworkConfig(network);
  const server = new Horizon.Server(cfg.horizonUrl);

  // ── Resolve deployment log ─────────────────────────────────────────────────
  let log;
  try {
    log = deploymentId
      ? Logger.load(deploymentId)
      : Logger.loadLatest(network);
  } catch (err) {
    console.error(`\n❌  ${err.message}\n`);
    process.exit(2);
  }

  const record = log.record;

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║   Nova Rewards Rollback — ${cfg.name.padEnd(26)}║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`  Deployment ID: ${record.deploymentId}`);
  console.log(`  Network:       ${record.network}`);
  console.log(`  Deployed at:   ${record.startedAt}`);
  console.log(`  Outcome:       ${record.outcome}`);
  if (dryRun) console.log('\n  ⚠️  DRY-RUN MODE — no transactions will be submitted\n');

  // ── Guard: check outcome ───────────────────────────────────────────────────
  if (record.outcome === 'rolled_back') {
    console.log('\n  This deployment has already been rolled back.\n');
    process.exit(0);
  }

  if (record.outcome === 'in_progress') {
    console.log('\n  ⚠️  Deployment is still in progress or failed mid-way.');
    console.log('  Rollback will attempt to reverse any completed steps.\n');
  }

  // ── Determine what was completed ──────────────────────────────────────────
  const successSteps = new Set(
    record.steps
      .filter((s) => s.status === Status.SUCCESS)
      .map((s) => s.name)
  );

  const hasInitialSupply  = successSteps.has('Issue initial NOVA supply');
  const hasTrustlineStep  = successSteps.has('Establish NOVA trustline');
  const hasEnvStep        = successSteps.has('Validate environment');

  console.log('  Completed steps to reverse:');
  if (hasInitialSupply) console.log('    • Burn NOVA tokens (send back to issuer)');
  if (hasTrustlineStep) console.log('    • Remove NOVA trustline from Distribution Account');
  if (!hasInitialSupply && !hasTrustlineStep) {
    console.log('    • Nothing reversible found in this deployment log');
  }
  console.log('');

  if (!hasInitialSupply && !hasTrustlineStep) {
    console.log('Nothing to roll back.\n');
    process.exit(0);
  }

  // ── Confirmation ───────────────────────────────────────────────────────────
  if (!dryRun) {
    const ok = await confirm('Proceed with rollback?');
    if (!ok) {
      console.log('\nRollback cancelled.\n');
      process.exit(0);
    }
  }

  // ── Load keypairs ──────────────────────────────────────────────────────────
  if (!process.env.DISTRIBUTION_SECRET || !process.env.ISSUER_SECRET) {
    console.error('\n❌  DISTRIBUTION_SECRET and ISSUER_SECRET must be set to rollback.\n');
    process.exit(1);
  }

  const issuerKeypair       = Keypair.fromSecret(process.env.ISSUER_SECRET);
  const distributionKeypair = Keypair.fromSecret(process.env.DISTRIBUTION_SECRET);
  const issuerPublic        = issuerKeypair.publicKey();
  const distributionPublic  = distributionKeypair.publicKey();
  const novaAsset           = new Asset(cfg.assetCode, issuerPublic);

  console.log('\n🔄  Starting rollback...\n');

  try {
    // ── Rollback 1: Burn NOVA tokens ─────────────────────────────────────────
    if (hasInitialSupply && !dryRun) {
      const { balance: novaBalance, hasTrustline } = await getNovaBalance(
        server, distributionPublic, novaAsset
      );

      if (!hasTrustline || parseFloat(novaBalance) === 0) {
        log.step({
          name:   'Burn NOVA tokens',
          status: Status.SKIPPED,
          data:   { reason: 'balance is 0 or trustline absent' },
        });
        console.log('  ⏭   Burn NOVA tokens — skipped (balance is 0)');
      } else {
        console.log(`  Burning ${novaBalance} NOVA (sending back to issuer)...`);

        const distAccount = await server.loadAccount(distributionPublic);
        const burnTx = new TransactionBuilder(distAccount, {
          fee:               String(cfg.baseFee),
          networkPassphrase: cfg.networkPassphrase,
        })
          .addOperation(
            Operation.payment({
              destination: issuerPublic,
              asset:       novaAsset,
              amount:      novaBalance,
            })
          )
          .setTimeout(cfg.txTimeout)
          .build();

        burnTx.sign(distributionKeypair);
        const burnResult = await server.submitTransaction(burnTx);

        log.step({
          name:   'Burn NOVA tokens',
          status: Status.ROLLEDBACK,
          data:   {
            amount:   novaBalance,
            txHash:   burnResult.hash,
            explorer: `${cfg.explorerBase}/${burnResult.hash}`,
          },
        });
        log.markRolledBack('Issue initial NOVA supply');
        console.log(`  ↩️   NOVA burned. Tx: ${burnResult.hash}`);
      }
    } else if (hasInitialSupply && dryRun) {
      console.log('  [dry-run] Would burn NOVA tokens from Distribution Account');
    }

    // ── Rollback 2: Remove trustline ─────────────────────────────────────────
    if (hasTrustlineStep && !dryRun) {
      const { balance: novaBalance, hasTrustline } = await getNovaBalance(
        server, distributionPublic, novaAsset
      );

      if (!hasTrustline) {
        log.step({
          name:   'Remove NOVA trustline',
          status: Status.SKIPPED,
          data:   { reason: 'trustline already absent' },
        });
        console.log('  ⏭   Remove NOVA trustline — skipped (not present)');
      } else if (parseFloat(novaBalance) > 0) {
        log.step({
          name:   'Remove NOVA trustline',
          status: Status.FAILED,
          error:  `Cannot remove trustline: NOVA balance is ${novaBalance}. Burn tokens first.`,
        });
        throw new Error(
          `Cannot remove NOVA trustline: Distribution Account still holds ${novaBalance} NOVA. ` +
          'The burn step must complete first.'
        );
      } else {
        console.log('  Removing NOVA trustline from Distribution Account...');

        const distAccount = await server.loadAccount(distributionPublic);
        const removeTx = new TransactionBuilder(distAccount, {
          fee:               String(cfg.baseFee),
          networkPassphrase: cfg.networkPassphrase,
        })
          .addOperation(
            Operation.changeTrust({
              asset: novaAsset,
              limit: '0',  // Setting limit to 0 removes the trustline
            })
          )
          .setTimeout(cfg.txTimeout)
          .build();

        removeTx.sign(distributionKeypair);
        const removeResult = await server.submitTransaction(removeTx);

        log.step({
          name:   'Remove NOVA trustline',
          status: Status.ROLLEDBACK,
          data:   {
            txHash:   removeResult.hash,
            explorer: `${cfg.explorerBase}/${removeResult.hash}`,
          },
        });
        log.markRolledBack('Establish NOVA trustline');
        console.log(`  ↩️   Trustline removed. Tx: ${removeResult.hash}`);
      }
    } else if (hasTrustlineStep && dryRun) {
      console.log('  [dry-run] Would remove NOVA trustline from Distribution Account');
    }

    // ── Rollback 3: Clear contract state file ─────────────────────────────────
    if (fs.existsSync(CONTRACT_STATE_PATH)) {
      if (!dryRun) {
        const backup = CONTRACT_STATE_PATH + '.rollback-backup';
        fs.copyFileSync(CONTRACT_STATE_PATH, backup);
        fs.unlinkSync(CONTRACT_STATE_PATH);
        console.log(`  ↩️   contract-state.json removed (backup: ${path.basename(backup)})`);
      } else {
        console.log('  [dry-run] Would remove deploy/contract-state.json');
      }
    }

    // ── Finalize ──────────────────────────────────────────────────────────────
    if (!dryRun) {
      log.finish('rolled_back');
    }

    console.log('\n✅  Rollback complete.\n');
    console.log('  ⚠️  Note: Stellar account creation is permanent.');
    console.log('       Funded accounts cannot be fully deleted from the ledger,');
    console.log('       but asset-level state (trustlines, balances) has been reversed.\n');

    return { success: true, deploymentId: record.deploymentId };

  } catch (err) {
    log.finish('failed', { rollbackError: err.message });

    console.error(`\n❌  Rollback failed: ${err.message}`);
    if (err.response?.data) {
      console.error('Stellar error:', JSON.stringify(
        err.response.data.extras?.result_codes ?? err.response.data, null, 2
      ));
    }
    console.error('');
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ─────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const network = resolveNetwork();
  const dryRun  = process.argv.includes('--dry-run');

  const deploymentId = (() => {
    const idx = process.argv.indexOf('--deployment-id');
    return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
  })();

  rollback({ network, deploymentId, dryRun })
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((err) => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}

module.exports = { rollback };
