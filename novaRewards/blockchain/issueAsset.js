require('dotenv').config();
const {
  Keypair,
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE,
} = require('stellar-sdk');
const { server, NOVA } = require('./stellarService');
const { verifyTrustline } = require('./trustline');

const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const INITIAL_SUPPLY = '1000000'; // 1,000,000 NOVA

/**
 * Funds a Testnet account using Friendbot.
 * Only calls Friendbot if the account does not yet exist on the network.
 *
 * @param {string} publicKey
 */
async function fundWithFriendbot(publicKey) {
  try {
    await server.loadAccount(publicKey);
    console.log(`  ${publicKey} already exists — Friendbot skipped`);
  } catch {
    // Account not found on network — safe to fund
    const res = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
    if (res.ok) {
      console.log(`  Funded ${publicKey} via Friendbot`);
    } else {
      const body = await res.text();
      throw new Error(`Friendbot failed for ${publicKey}: ${body}`);
    }
  }
}


/**
 * One-time idempotent setup script:
 * 1. Funds Issuer and Distribution accounts via Friendbot (Testnet only)
 * 2. Establishes a NOVA trustline on the Distribution Account (if not already set)
 * 3. Sends the initial NOVA supply from Issuer to Distribution Account
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */
async function issueAsset() {
  const issuerKeypair = Keypair.fromSecret(process.env.ISSUER_SECRET);
  const distributionKeypair = Keypair.fromSecret(process.env.DISTRIBUTION_SECRET);

  console.log('=== NovaRewards Asset Issuance ===');
  console.log(`Issuer:       ${issuerKeypair.publicKey()}`);
  console.log(`Distribution: ${distributionKeypair.publicKey()}`);

  // Step 1: Fund both accounts via Friendbot (idempotent — skips if already funded)
  console.log('\n[1] Funding accounts via Friendbot...');
  await fundWithFriendbot(issuerKeypair.publicKey());
  await fundWithFriendbot(distributionKeypair.publicKey());

  // Step 2: Establish trustline on Distribution Account (idempotent check)
  console.log('\n[2] Checking Distribution Account trustline...');
  const { exists: trustlineExists } = await verifyTrustline(distributionKeypair.publicKey());

  if (trustlineExists) {
    console.log('  Trustline already exists — skipping.');
  } else {
    console.log('  Creating NOVA trustline on Distribution Account...');
    const distAccount = await server.loadAccount(distributionKeypair.publicKey());

    const trustlineTx = new TransactionBuilder(distAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(Operation.changeTrust({ asset: NOVA }))
      .setTimeout(180)
      .build();

    trustlineTx.sign(distributionKeypair);
    const trustlineResult = await server.submitTransaction(trustlineTx);
    console.log(`  Trustline created. Tx hash: ${trustlineResult.hash}`);
  }

  // Step 3: Send initial NOVA supply from Issuer to Distribution Account
  // Check current balance first to stay idempotent
  console.log('\n[3] Checking Distribution Account NOVA balance...');
  const distAccountCheck = await server.loadAccount(distributionKeypair.publicKey());
  const existingBalance = distAccountCheck.balances.find(
    (b) =>
      b.asset_type !== 'native' &&
      b.asset_code === 'NOVA' &&
      b.asset_issuer === issuerKeypair.publicKey()
  );

  if (existingBalance && parseFloat(existingBalance.balance) > 0) {
    console.log(
      `  Distribution Account already holds ${existingBalance.balance} NOVA — skipping initial supply.`
    );
  } else {
    console.log(`  Sending ${INITIAL_SUPPLY} NOVA to Distribution Account...`);
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

    const paymentTx = new TransactionBuilder(issuerAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: distributionKeypair.publicKey(),
          asset: NOVA,
          amount: INITIAL_SUPPLY,
        })
      )
      .setTimeout(180)
      .build();

    paymentTx.sign(issuerKeypair);
    const paymentResult = await server.submitTransaction(paymentTx);
    console.log(`  Initial supply sent. Tx hash: ${paymentResult.hash}`);
  }

  console.log('\n=== Asset issuance complete ===');
}

module.exports = { issueAsset };
