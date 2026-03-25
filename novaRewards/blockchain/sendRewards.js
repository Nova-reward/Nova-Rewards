require('dotenv').config();
const {
  Keypair,
  TransactionBuilder,
  Operation,
  Memo,
  Networks,
  BASE_FEE,
  StrKey,
} = require('stellar-sdk');
const { server, NOVA } = require('./stellarService');
const { verifyTrustline } = require('./trustline');

const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

/**
 * Distributes NOVA tokens from the Distribution Account to a customer wallet.
 * Signs the transaction server-side using DISTRIBUTION_SECRET.
 * Requirements: 3.2, 3.3, 3.6
 *
 * @param {object} params
 * @param {string} params.toWallet  - Recipient's Stellar public key
 * @param {string} params.amount    - Amount of NOVA to send (e.g. "10.0000000")
 * @returns {Promise<{ success: boolean, txHash: string }>}
 * @throws {Error} with error.code set to 'no_trustline' or 'insufficient_balance'
 */
async function distributeRewards({ toWallet, amount }) {
  // 0. Validate recipient address before any network calls
  if (!toWallet || !StrKey.isValidEd25519PublicKey(toWallet)) {
    const err = new Error(
      `Invalid Stellar address: "${toWallet}". Must be a valid Ed25519 public key.`
    );
    err.code = 'invalid_address';
    throw err;
  }

  // 1. Verify recipient has a NOVA trustline before attempting payment
  const { exists } = await verifyTrustline(toWallet);
  if (!exists) {
    const err = new Error(
      'Recipient does not have a NOVA trustline. They must create one before receiving rewards.'
    );
    err.code = 'no_trustline';
    throw err;
  }

  // 2. Load the Distribution Account
  const distributionKeypair = Keypair.fromSecret(process.env.DISTRIBUTION_SECRET);
  const distributionAccount = await server.loadAccount(
    distributionKeypair.publicKey()
  );

  // 3. Check Distribution Account has sufficient NOVA balance
  const novaBalance = distributionAccount.balances.find(
    (b) =>
      b.asset_type !== 'native' &&
      b.asset_code === 'NOVA' &&
      b.asset_issuer === process.env.ISSUER_PUBLIC
  );
  const available = novaBalance ? parseFloat(novaBalance.balance) : 0;
  if (available < parseFloat(amount)) {
    const err = new Error(
      `Distribution Account has insufficient NOVA balance. Available: ${available}, Requested: ${amount}`
    );
    err.code = 'insufficient_balance';
    throw err;
  }

  // 4. Build, sign, and submit the payment transaction
  const transaction = new TransactionBuilder(distributionAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: toWallet,
        asset: NOVA,
        amount: String(amount),
      })
    )
    .addMemo(Memo.text('NovaRewards distribution'))
    .setTimeout(180)
    .build();

  transaction.sign(distributionKeypair);

  const result = await server.submitTransaction(transaction);

  return {
    success: true,
    txHash: result.hash,
  };
}

module.exports = { distributeRewards };
