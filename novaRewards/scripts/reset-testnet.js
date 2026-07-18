#!/usr/bin/env node
/**
 * NovaRewards Testnet Reset Script
 *
 * Re-funds the Issuer and Distribution accounts via Friendbot and
 * re-issues the initial NOVA supply. Useful for resetting Testnet
 * state during development without manually re-running setup.js steps.
 *
 * Usage:
 *   node scripts/reset-testnet.js
 *
 * Requirements: ISSUER_SECRET and DISTRIBUTION_SECRET must be set in .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const FRIENDBOT_URL = 'https://friendbot.stellar.org';

async function refundAccount(publicKey) {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (res.ok) {
    console.log(`  Re-funded ${publicKey} via Friendbot`);
  } else {
    const body = await res.text();
    throw new Error(`Friendbot failed for ${publicKey}: ${body}`);
  }
}

async function main() {
  if (!process.env.ISSUER_SECRET || !process.env.DISTRIBUTION_SECRET) {
    console.error('ERROR: ISSUER_SECRET and DISTRIBUTION_SECRET must be set in .env');
    process.exit(1);
  }

  const { Keypair } = require('stellar-sdk');
  const issuerKeypair = Keypair.fromSecret(process.env.ISSUER_SECRET);
  const distributionKeypair = Keypair.fromSecret(process.env.DISTRIBUTION_SECRET);

  // Expose public keys so issueAsset.js can read them
  process.env.ISSUER_PUBLIC = issuerKeypair.publicKey();
  process.env.DISTRIBUTION_PUBLIC = distributionKeypair.publicKey();
  process.env.STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'testnet';
  process.env.HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';

  console.log('=== NovaRewards Testnet Reset ===');
  console.log(`Issuer:       ${issuerKeypair.publicKey()}`);
  console.log(`Distribution: ${distributionKeypair.publicKey()}`);

  console.log('\n[1] Re-funding accounts via Friendbot...');
  await refundAccount(issuerKeypair.publicKey());
  await refundAccount(distributionKeypair.publicKey());

  console.log('\n[2] Re-issuing NOVA supply...');
  const { issueAsset } = require('../blockchain/issueAsset');
  await issueAsset();

  console.log('\n=== Testnet reset complete ===');
}

main().catch((err) => {
  console.error('\nReset failed:', err.message);
  if (err.response?.data) {
    console.error('Stellar error:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
