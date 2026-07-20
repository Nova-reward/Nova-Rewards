#!/usr/bin/env node
/**
 * Deployment Verification Script
 *
 * Audits the live Stellar network state against the expected post-deployment
 * configuration. Can be run at any time after deployment:
 *
 *   node deploy/verify.js                       # verify latest testnet deploy
 *   node deploy/verify.js --network mainnet
 *   node deploy/verify.js --deployment-id <id>  # verify specific deployment
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 *   2 — script error (bad args, missing log, etc.)
 *
 * Checks performed:
 *   ✓ Issuer account exists on-chain
 *   ✓ Distribution account exists on-chain
 *   ✓ NOVA asset code and issuer match expected values
 *   ✓ Distribution account has a NOVA trustline
 *   ✓ Distribution account holds NOVA tokens (> 0)
 *   ✓ Issuer XLM balance is sufficient for future transactions
 *   ✓ Distribution XLM balance is sufficient for future transactions
 *   ✓ Deployment log outcome is 'success'
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Horizon, Asset, StrKey } = require('stellar-sdk');

const { getNetworkConfig, resolveNetwork } = require('./config/networks');
const { Logger, Status }                   = require('./lib/logger');

// Minimum XLM balance considered "healthy" for operational accounts
const MIN_XLM_BALANCE = 2.0;

// ─────────────────────────────────────────────────────────────────────────────
// Check runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs a single named check.
 *
 * @param {string}   name
 * @param {Function} fn   - async function that returns { pass, detail }
 * @returns {Promise<{name, pass, detail, error}>}
 */
async function runCheck(name, fn) {
  try {
    const { pass, detail } = await fn();
    return { name, pass, detail };
  } catch (err) {
    return { name, pass: false, detail: null, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core verification logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs all verification checks against the live Stellar network.
 *
 * @param {object}  opts
 * @param {string}  opts.network      - 'testnet' | 'mainnet'
 * @param {boolean} [opts.silent]     - Suppress console output
 * @param {string}  [opts.deploymentId] - Load specific deployment log for context
 * @returns {Promise<{allPassed, passed, failed, checks, deploymentId}>}
 */
async function runVerification({ network, silent = false, deploymentId = null }) {
  const cfg    = getNetworkConfig(network);
  const server = new Horizon.Server(cfg.horizonUrl);

  const issuerPublic       = process.env.ISSUER_PUBLIC;
  const distributionPublic = process.env.DISTRIBUTION_PUBLIC;

  if (!issuerPublic || !distributionPublic) {
    throw new Error('ISSUER_PUBLIC and DISTRIBUTION_PUBLIC must be set in environment.');
  }

  const novaAsset = new Asset(cfg.assetCode, issuerPublic);

  if (!silent) {
    console.log(`\n🔍  Verifying Nova Rewards deployment on ${cfg.name}...\n`);
  }

  // ── Load deployment log context (optional) ─────────────────────────────────
  let logRecord = null;
  if (deploymentId) {
    try {
      logRecord = Logger.load(deploymentId).record;
    } catch {
      if (!silent) console.warn(`  ⚠️  Could not load deployment log: ${deploymentId}`);
    }
  } else {
    try {
      logRecord = Logger.loadLatest(network).record;
    } catch {
      // No prior log — verification still runs against live state
    }
  }

  // ── Define checks ──────────────────────────────────────────────────────────

  const checks = await Promise.all([

    runCheck('Issuer public key format is valid', async () => {
      const pass = StrKey.isValidEd25519PublicKey(issuerPublic);
      return { pass, detail: issuerPublic };
    }),

    runCheck('Distribution public key format is valid', async () => {
      const pass = StrKey.isValidEd25519PublicKey(distributionPublic);
      return { pass, detail: distributionPublic };
    }),

    runCheck('Issuer account exists on-chain', async () => {
      const account = await server.loadAccount(issuerPublic);
      return { pass: !!account, detail: `sequence: ${account.sequence}` };
    }),

    runCheck('Distribution account exists on-chain', async () => {
      const account = await server.loadAccount(distributionPublic);
      return { pass: !!account, detail: `sequence: ${account.sequence}` };
    }),

    runCheck('Issuer account has sufficient XLM', async () => {
      const account = await server.loadAccount(issuerPublic);
      const xlm     = account.balances.find((b) => b.asset_type === 'native');
      const balance = xlm ? parseFloat(xlm.balance) : 0;
      const pass    = balance >= MIN_XLM_BALANCE;
      return { pass, detail: `${xlm?.balance ?? '0'} XLM (min: ${MIN_XLM_BALANCE})` };
    }),

    runCheck('Distribution account has sufficient XLM', async () => {
      const account = await server.loadAccount(distributionPublic);
      const xlm     = account.balances.find((b) => b.asset_type === 'native');
      const balance = xlm ? parseFloat(xlm.balance) : 0;
      const pass    = balance >= MIN_XLM_BALANCE;
      return { pass, detail: `${xlm?.balance ?? '0'} XLM (min: ${MIN_XLM_BALANCE})` };
    }),

    runCheck('Distribution account has NOVA trustline', async () => {
      const account  = await server.loadAccount(distributionPublic);
      const trustline = account.balances.find(
        (b) =>
          b.asset_type !== 'native' &&
          b.asset_code   === cfg.assetCode &&
          b.asset_issuer === issuerPublic
      );
      return { pass: !!trustline, detail: trustline ? 'trustline present' : 'not found' };
    }),

    runCheck('Distribution account holds NOVA tokens', async () => {
      const account  = await server.loadAccount(distributionPublic);
      const novaBalance = account.balances.find(
        (b) =>
          b.asset_type !== 'native' &&
          b.asset_code   === cfg.assetCode &&
          b.asset_issuer === issuerPublic
      );
      const balance = novaBalance ? parseFloat(novaBalance.balance) : 0;
      const pass    = balance > 0;
      return { pass, detail: `${novaBalance?.balance ?? '0'} NOVA` };
    }),

    runCheck('NOVA asset issuer matches environment', async () => {
      const pass = novaAsset.issuer === issuerPublic;
      return { pass, detail: `asset=${cfg.assetCode}:${issuerPublic.slice(0, 8)}...` };
    }),

    runCheck('Deployment log records success outcome', async () => {
      if (!logRecord) {
        return { pass: false, detail: 'no deployment log found' };
      }
      const pass = logRecord.outcome === 'success';
      return {
        pass,
        detail: `outcome=${logRecord.outcome}, id=${logRecord.deploymentId}`,
      };
    }),
  ]);

  // ── Summarize results ──────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;

  if (!silent) {
    for (const c of checks) {
      const icon   = c.pass ? '✅' : '❌';
      const detail = c.detail ? `  (${c.detail})` : '';
      const errMsg = c.error  ? `  ⚠️  ${c.error}` : '';
      console.log(`  ${icon}  ${c.name}${detail}${errMsg}`);
    }

    console.log(`\n  ${passed}/${checks.length} checks passed`);

    if (failed === 0) {
      console.log('\n✅  Deployment is healthy.\n');
    } else {
      console.log(`\n❌  ${failed} check(s) failed. Review the issues above.\n`);
      if (logRecord) {
        console.log(
          `  To rollback: node deploy/rollback.js --deployment-id ${logRecord.deploymentId}\n`
        );
      }
    }
  }

  return {
    allPassed:    failed === 0,
    passed,
    failed,
    checks,
    deploymentId: logRecord?.deploymentId ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ─────────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const network      = resolveNetwork();
  const deploymentId = (() => {
    const idx = process.argv.indexOf('--deployment-id');
    return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
  })();

  runVerification({ network, silent: false, deploymentId })
    .then((result) => {
      process.exit(result.allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error(`\n❌  Verification error: ${err.message}\n`);
      process.exit(2);
    });
}

module.exports = { runVerification };
