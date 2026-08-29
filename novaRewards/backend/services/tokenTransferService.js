'use strict';

const { Operation, Keypair, StrKey } = require('stellar-sdk');
const { NOVA, isValidStellarAddress, getNOVABalance } = require('../../blockchain/stellarService');
const { verifyTrustline } = require('../../blockchain/trustline');
const stellarTxService = require('./stellarTransactionService');

const AMOUNT_PATTERN = /^\d+(\.\d{1,7})?$/;

// Routed through an overridable object (rather than calling the imported
// bindings directly) so unit tests can substitute fakes for the Horizon/DB
// calls without a real network connection.
const deps = {
  getNOVABalance,
  verifyTrustline,
  submit: (...args) => stellarTxService.submit(...args),
};

function createError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function validateAmount(amount) {
  if (amount === undefined || amount === null || amount === '') {
    throw createError('amount is required', 400, 'validation_error');
  }
  if (!AMOUNT_PATTERN.test(String(amount))) {
    throw createError('amount must be a positive number with up to 7 decimal places', 400, 'validation_error');
  }
  if (Number(amount) <= 0) {
    throw createError('amount must be greater than zero', 400, 'validation_error');
  }
  return String(amount);
}

/**
 * Maps a Horizon submission failure to a specific, user-facing error code.
 * `stellarTransactionService.submit` already surfaces these as 400s with the
 * raw Horizon result codes joined into the message — this re-maps the common
 * payment-operation failures to codes callers can branch on directly.
 */
function mapStellarSubmissionError(err) {
  const message = err?.message || '';
  if (message.includes('op_underfunded')) {
    return createError('Sender has insufficient NOVA balance for this transfer', 400, 'insufficient_balance');
  }
  if (message.includes('op_no_destination')) {
    return createError('Destination account does not exist on the Stellar network', 400, 'destination_not_found');
  }
  if (message.includes('op_no_trust')) {
    return createError('Destination account does not have a NOVA trustline', 400, 'destination_no_trustline');
  }
  if (message.includes('op_line_full')) {
    return createError("Destination account's NOVA trustline limit would be exceeded", 400, 'destination_trustline_full');
  }
  return err;
}

/**
 * Transfers NOVA tokens from an authenticated user's linked wallet to another
 * Stellar account. Builds and submits a payment operation, waits for ledger
 * confirmation, and records the transfer in the transactions table.
 *
 * @param {object} params
 * @param {number} params.userId - Authenticated user's DB id
 * @param {string} params.walletAddress - Authenticated user's linked Stellar public key
 * @param {string} params.destination - Recipient's Stellar public key
 * @param {string|number} params.amount - Amount of NOVA to transfer
 * @param {string} params.signerSecret - Secret key of the sending wallet
 * @param {string} [params.memo] - Optional memo text
 * @returns {Promise<{ txHash: string, ledger: number, status: string, amount: string, fromWallet: string, toWallet: string, balance: string }>}
 */
async function transferTokens({ userId, walletAddress, destination, amount, signerSecret, memo }) {
  if (!walletAddress) {
    throw createError('Authenticated user has no linked Stellar wallet', 400, 'no_wallet_linked');
  }

  if (!destination || !isValidStellarAddress(destination)) {
    throw createError('destination must be a valid Stellar public key', 400, 'validation_error');
  }

  if (destination === walletAddress) {
    throw createError("destination cannot be the sender's own wallet", 400, 'validation_error');
  }

  const validAmount = validateAmount(amount);

  if (!signerSecret || !StrKey.isValidEd25519SecretSeed(signerSecret)) {
    throw createError('signerSecret must be a valid Stellar secret key', 400, 'validation_error');
  }

  const signerKeypair = Keypair.fromSecret(signerSecret);
  if (signerKeypair.publicKey() !== walletAddress) {
    throw createError("signerSecret does not match the authenticated user's linked wallet", 403, 'forbidden');
  }

  const currentBalance = await deps.getNOVABalance(walletAddress);
  if (Number(currentBalance) < Number(validAmount)) {
    throw createError('Insufficient NOVA balance for this transfer', 400, 'insufficient_balance');
  }

  const { exists: destinationHasTrustline } = await deps.verifyTrustline(destination);
  if (!destinationHasTrustline) {
    throw createError('Destination account does not have a NOVA trustline', 400, 'destination_no_trustline');
  }

  const paymentOp = Operation.payment({
    destination,
    asset: NOVA,
    amount: validAmount,
  });

  let result;
  try {
    result = await deps.submit({
      sourceAddress: walletAddress,
      operations: [paymentOp],
      signers: [signerKeypair],
      options: {
        memo,
        txType: 'transfer',
        amount: validAmount,
        fromWallet: walletAddress,
        toWallet: destination,
        userId,
      },
    });
  } catch (err) {
    throw mapStellarSubmissionError(err);
  }

  const updatedBalance = await deps.getNOVABalance(walletAddress).catch(() => currentBalance);

  return {
    txHash: result.txHash,
    ledger: result.ledger,
    status: result.status,
    amount: validAmount,
    fromWallet: walletAddress,
    toWallet: destination,
    balance: updatedBalance,
  };
}

module.exports = {
  transferTokens,
  validateAmount,
  mapStellarSubmissionError,
  _deps: deps,
};
