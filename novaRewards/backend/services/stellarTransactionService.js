const {
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE,
  Keypair,
} = require('stellar-sdk');
const { server } = require('../../blockchain/stellarService');
const { recordTransaction } = require('../db/transactionRepository');
const { getConfig, getRequiredConfig } = require('./configService');
const logger = require('../lib/logger');


// ---------------------------------------------------------------------------
// Network configuration — selected via STELLAR_NETWORK env var
// ---------------------------------------------------------------------------
const NETWORK_PASSPHRASE =
  getConfig('STELLAR_NETWORK', 'testnet') === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

const DEFAULT_TIMEOUT = 180;
const FEE_BUMP_MULTIPLIER = 2;
const MAX_FEE_BUMP_ATTEMPTS = 3;
const STUCK_RESULT_CODES = [
  'tx_bad_seq',
  'tx_insufficient_fee',
  'tx_too_late',
];

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------
function createError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

// ---------------------------------------------------------------------------
// Core: submit(operation, signers, options)
// ---------------------------------------------------------------------------

/**
 * Builds, signs, and submits a Stellar transaction.
 *
 * Flow:
 *  1. Fetch fresh sequence number from Horizon via loadAccount
 *  2. Build transaction with the provided operation(s)
 *  3. Sign with all provided signers
 *  4. Submit to Horizon
 *  5. If the transaction is stuck (bad_seq, insufficient_fee, too_late),
 *     automatically retry with a fee-bump transaction
 *  6. Parse the result and store in DB
 *
 * @param {object} params
 * @param {string} params.sourceAddress - Source account public key
 * @param {import('stellar-sdk').xdr.Operation[]} params.operations - One or more Stellar operations
 * @param {import('stellar-sdk').Keypair[]} params.signers - Keypairs to sign with
 * @param {object} [params.options]
 * @param {number} [params.options.timeout=180] - Transaction timeout in seconds
 * @param {string} [params.options.memo] - Memo text
 * @param {string} [params.options.feeSourceSecret] - Secret key for fee-bump fee source (if different)
 * @param {object} [params.options.metadata] - Metadata to store alongside the DB record
 * @param {string} [params.options.txType='transfer'] - Transaction type for DB classification
 * @param {string} [params.options.amount] - Amount for DB record
 * @param {string} [params.options.fromWallet] - From wallet for DB record
 * @param {string} [params.options.toWallet] - To wallet for DB record
 * @param {number} [params.options.merchantId] - Merchant ID for DB record
 * @param {number} [params.options.campaignId] - Campaign ID for DB record
 * @param {number} [params.options.userId] - User ID for DB record
 * @returns {Promise<{ txHash: string, ledger: number, status: string, resultXdr: string }>}
 */
async function submit({ sourceAddress, operations, signers, options = {} }) {
  if (!sourceAddress) {
    throw createError('sourceAddress is required', 400, 'validation_error');
  }

  if (!operations || (Array.isArray(operations) && operations.length === 0)) {
    throw createError('At least one operation is required', 400, 'validation_error');
  }

  if (!signers || (Array.isArray(signers) && signers.length === 0)) {
    throw createError('At least one signer is required', 400, 'validation_error');
  }

  const ops = Array.isArray(operations) ? operations : [operations];
  const signerList = Array.isArray(signers) ? signers : [signers];

  // 1. Fetch fresh sequence number from Horizon
  const account = await server.loadAccount(sourceAddress);

  // 2. Build transaction
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  let builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  for (const op of ops) {
    builder = builder.addOperation(op);
  }

  if (options.memo) {
    builder = builder.addMemo(require('stellar-sdk').Memo.text(options.memo));
  }

  builder = builder.setTimeout(timeout);
  const transaction = builder.build();

  // 3. Sign with all signers
  for (const signer of signerList) {
    transaction.sign(signer);
  }

  // 4. Submit with automatic fee-bump retry for stuck transactions
  const result = await submitWithFeeBumpRetry(transaction, {
    ...options,
    sourceAddress,
    operations: ops,
    signers: signerList,
  });


  // 5. Parse and store result in DB
  await storeTransactionResult(result, options);

  return result;
}

// ---------------------------------------------------------------------------
// Fee bump for stuck transactions
// ---------------------------------------------------------------------------

/**
 * Submits a transaction, and if it's stuck (insufficient_fee, too_late),
 * retries with a fee-bump transaction up to MAX_FEE_BUMP_ATTEMPTS times.
 *
 * tx_bad_seq is handled separately inside submitHorizonTransaction (sequence
 * refresh + rebuild once) and does NOT trigger the fee-bump path.
 *
 * Before each fee-bump attempt the source account sequence number is re-fetched
 * from Horizon so that the rebuilt inner transaction carries a fresh sequence.
 * This prevents infinite retries under high-load conditions where the account
 * sequence advances between attempts.
 *
 * Fee doubling follows 2^(attempt+1) progression:
 *   attempt 0 → baseFee * 2
 *   attempt 1 → baseFee * 4
 *   attempt 2 → baseFee * 8
 *
 * @param {import('stellar-sdk').Transaction} transaction
 * @param {object} options
 * @returns {Promise<{ txHash: string, ledger: number, status: string, resultXdr: string }>}
 */
async function submitWithFeeBumpRetry(transaction, options = {}) {
  let lastError;

  const submitContext = {
    sourceAddress: options?.sourceAddress,
    operations: options?.operations,
    signers: options?.signers,
    feeSourceSecret: options?.feeSourceSecret,
    timeout: options?.timeout,
    memo: options?.memo,
    txType: options?.txType,
  };

<<<<<<< HEAD
  // Initial submission attempt (not a fee-bump attempt).
  try {
    const horizonResult = await submitHorizonTransaction(transaction, {
      options,
      didRefreshSequenceRetry,
      refreshSequenceAndRebuildOnce: async () => {
        if (didRefreshSequenceRetry) return null;
        didRefreshSequenceRetry = true;
        return refreshAndRebuildTransaction(submitContext);
      },
=======
  // First, attempt the normal submission flow (which may refresh once on tx_bad_seq)
  try {
    const horizonResult = await submitHorizonTransaction(transaction, {
      // allow submitHorizonTransaction to handle an internal one-time tx_bad_seq refresh
      refreshSequenceAndRebuildOnce: async () => refreshAndRebuildTransaction({
        sourceAddress: submitContext.sourceAddress,
        operations: submitContext.operations,
        signers: submitContext.signers,
        memo: submitContext.memo,
        timeout: submitContext.timeout,
      }),
>>>>>>> b06e47e (fix: refresh sequence before fee-bump attempts; enforce MAX_FEE_BUMP_ATTEMPTS; add tests for fee-bump retry paths)
    });

    return {
      txHash: horizonResult.hash,
      ledger: horizonResult.ledger,
      status: 'submitted',
      resultXdr: horizonResult.result_xdr,
      _raw: horizonResult,
    };
  } catch (err) {
    lastError = err;

    const resultCodes = extractResultCodes(err);
<<<<<<< HEAD
    // Also check err.code — submitHorizonTransaction re-throws Horizon errors
    // as typed errors with .code set to the original Horizon result code.
    const allCodes = resultCodes.length ? resultCodes : (err.code ? [err.code] : []);
    // Only tx_insufficient_fee and tx_too_late trigger the fee-bump path.
    // tx_bad_seq is already handled (rebuild once) inside submitHorizonTransaction.
    const FEE_BUMP_CODES = STUCK_RESULT_CODES.filter((c) => c !== 'tx_bad_seq');
    const isFeeBumpCandidate = FEE_BUMP_CODES.some((code) => allCodes.includes(code));

    if (!isFeeBumpCandidate) {
      // Not a fee-bump candidate — propagate immediately.
      throw err;
    }
  }

  // Fee-bump retry loop: exactly MAX_FEE_BUMP_ATTEMPTS iterations (0, 1, 2).
  for (let attempt = 0; attempt < MAX_FEE_BUMP_ATTEMPTS; attempt++) {
    try {
      const feeSourceSecret =
        options.feeSourceSecret || getRequiredConfig('FEE_SOURCE_SECRET');
      const feeSourceKeypair = Keypair.fromSecret(feeSourceSecret);

      // Re-fetch the sequence number before each fee-bump attempt so that the
      // inner transaction carries a fresh sequence even if the account advanced
      // between attempts.
      const rebuiltInnerTx = await refreshAndRebuildTransaction(submitContext);
      const innerTx = rebuiltInnerTx || transaction;

      // Fee doubles on every attempt from the canonical base fee:
      // attempt 0 -> BASE_FEE * 2, attempt 1 -> BASE_FEE * 4, attempt 2 -> BASE_FEE * 8
      const baseFee = parseInt(BASE_FEE, 10);
      const bumpedFee = String(baseFee * Math.pow(FEE_BUMP_MULTIPLIER, attempt + 1));
=======
    const isStuck = STUCK_RESULT_CODES.some((code) => resultCodes.includes(code));

    if (!isStuck) {
      const resultCodes = extractResultCodes(lastError);
      throw createError(
        `Transaction submission failed: ${resultCodes.join(', ') || lastError.message}`,
        400,
        'tx_submission_failed',
      );
    }
  }

  // If we reach here the transaction is considered "stuck" and we'll attempt
  // up to MAX_FEE_BUMP_ATTEMPTS fee-bump submissions. Before each fee-bump
  // attempt we must refresh the sequence number and rebuild the inner tx.
  for (let attempt = 1; attempt <= MAX_FEE_BUMP_ATTEMPTS; attempt++) {
    try {
      // Re-fetch sequence number and rebuild the inner transaction to avoid
      // reusing an outdated sequence across attempts.
      const rebuiltInner = await refreshAndRebuildTransaction({
        sourceAddress: submitContext.sourceAddress,
        operations: submitContext.operations,
        signers: submitContext.signers,
        memo: submitContext.memo,
        timeout: submitContext.timeout,
      });

      if (rebuiltInner) {
        transaction = rebuiltInner;
      }

      const feeSourceSecret = options.feeSourceSecret || getRequiredConfig('FEE_SOURCE_SECRET');
      const feeSourceKeypair = Keypair.fromSecret(feeSourceSecret);

      // Double the fee on each attempt: attempt=1 => *2, attempt=2 => *4, etc.
      const baseFee = parseInt(transaction.fee, 10) || parseInt(BASE_FEE, 10);
      const bumpedFee = String(baseFee * Math.pow(FEE_BUMP_MULTIPLIER, attempt));
>>>>>>> b06e47e (fix: refresh sequence before fee-bump attempts; enforce MAX_FEE_BUMP_ATTEMPTS; add tests for fee-bump retry paths)

      const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
        feeSourceKeypair,
        bumpedFee,
        innerTx,
        NETWORK_PASSPHRASE,
      );
      feeBumpTx.sign(feeSourceKeypair);

      const feeBumpResult = await submitFeeBumpTransaction(feeBumpTx);
      return feeBumpResult;
<<<<<<< HEAD
    } catch (err) {
      lastError = err;
      // Continue to next attempt unless this was the last one.
    }
  }

  // All fee-bump attempts exhausted — throw a typed error.
  const resultCodes = extractResultCodes(lastError);
  throw createError(
    `Fee-bump retry exhausted after ${MAX_FEE_BUMP_ATTEMPTS} attempts: ${resultCodes.join(', ') || lastError.message}`,
    503,
    'fee_bump_exhausted',
=======
    } catch (feeErr) {
      lastError = feeErr;

      const codes = extractResultCodes(feeErr);
      const stillStuck = STUCK_RESULT_CODES.some((c) => codes.includes(c));

      // If this attempt exhausted allowed attempts or error is not a stuck code,
      // stop retrying and throw a typed error below.
      if (attempt >= MAX_FEE_BUMP_ATTEMPTS || !stillStuck) {
        break;
      }

      // Otherwise continue to next attempt (loop will refresh sequence again).
      continue;
    }
  }

  const finalCodes = extractResultCodes(lastError);
  throw createError(
    `Transaction submission failed: ${finalCodes.join(', ') || lastError.message}`,
    400,
    'tx_submission_failed',
>>>>>>> b06e47e (fix: refresh sequence before fee-bump attempts; enforce MAX_FEE_BUMP_ATTEMPTS; add tests for fee-bump retry paths)
  );
}




/**
 * Submits a fee-bump transaction to Horizon.
 *
 * @param {import('stellar-sdk').FeeBumpTransaction} feeBumpTx
 * @returns {Promise<{ txHash: string, ledger: number, status: string, resultXdr: string }>}
 */
async function submitFeeBumpTransaction(feeBumpTx) {
  let lastError;

  const submitContext = {
    sourceAddress: options?.sourceAddress,
    operations: options?.operations,
    signers: options?.signers,
    feeSourceSecret: options?.feeSourceSecret,
    timeout: options?.timeout,
    memo: options?.memo,
    txType: options?.txType,
  };

  // First, attempt the normal submission flow (which may refresh once on tx_bad_seq)
  try {
    const horizonResult = await submitHorizonTransaction(transaction, {
      // allow submitHorizonTransaction to handle an internal one-time tx_bad_seq refresh
      refreshSequenceAndRebuildOnce: async () => refreshAndRebuildTransaction({
        sourceAddress: submitContext.sourceAddress,
        operations: submitContext.operations,
        signers: submitContext.signers,
        memo: submitContext.memo,
        timeout: submitContext.timeout,
      }),
    });

    return {
      txHash: horizonResult.hash,
      ledger: horizonResult.ledger,
      status: 'submitted',
      resultXdr: horizonResult.result_xdr,
      _raw: horizonResult,
    };
  } catch (err) {
    lastError = err;

    const resultCodes = extractResultCodes(err);
    const isStuck = STUCK_RESULT_CODES.some((code) => resultCodes.includes(code));

    if (!isStuck) {
      const resultCodes = extractResultCodes(lastError);
      throw createError(
        `Transaction submission failed: ${resultCodes.join(', ') || lastError.message}`,
        400,
        'tx_submission_failed',
      );
    }
  }

  // If we reach here the transaction is considered "stuck" and we'll attempt
  // up to MAX_FEE_BUMP_ATTEMPTS fee-bump submissions. Before each fee-bump
  // attempt we must refresh the sequence number and rebuild the inner tx.
  for (let attempt = 1; attempt <= MAX_FEE_BUMP_ATTEMPTS; attempt++) {
    try {
      // Re-fetch sequence number and rebuild the inner transaction to avoid
      // reusing an outdated sequence across attempts.
      const rebuiltInner = await refreshAndRebuildTransaction({
        sourceAddress: submitContext.sourceAddress,
        operations: submitContext.operations,
        signers: submitContext.signers,
        memo: submitContext.memo,
        timeout: submitContext.timeout,
      });

      if (rebuiltInner) {
        transaction = rebuiltInner;
      }

      const feeSourceSecret = options.feeSourceSecret || getRequiredConfig('FEE_SOURCE_SECRET');
      const feeSourceKeypair = Keypair.fromSecret(feeSourceSecret);

      // Double the fee on each attempt: attempt=1 => *2, attempt=2 => *4, etc.
      const baseFee = parseInt(transaction.fee, 10) || parseInt(BASE_FEE, 10);
      const bumpedFee = String(baseFee * Math.pow(FEE_BUMP_MULTIPLIER, attempt));

      const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
        feeSourceKeypair,
        bumpedFee,
        transaction,
        NETWORK_PASSPHRASE,
      );
      feeBumpTx.sign(feeSourceKeypair);

      const feeBumpResult = await submitFeeBumpTransaction(feeBumpTx);
      return feeBumpResult;
    } catch (feeErr) {
      lastError = feeErr;

      const codes = extractResultCodes(feeErr);
      const stillStuck = STUCK_RESULT_CODES.some((c) => codes.includes(c));

      // If this attempt exhausted allowed attempts or error is not a stuck code,
      // stop retrying and throw a typed error below.
      if (attempt >= MAX_FEE_BUMP_ATTEMPTS || !stillStuck) {
        break;
      }

      // Otherwise continue to next attempt (loop will refresh sequence again).
      continue;
    }
  }

  const finalCodes = extractResultCodes(lastError);
  throw createError(
    `Transaction submission failed: ${finalCodes.join(', ') || lastError.message}`,
    400,
    'tx_submission_failed',
  );
}

function findPrimaryHorizonCode(err) {
  const codes = extractResultCodes(err);
  if (codes?.length) return codes[0];

  // Fallback to extras/result codes string if available
  return err?.response?.data?.extras?.result_codes?.transaction?.[0] || err?.response?.data?.title || err?.response?.data?.type || 'horizon_error';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshAndRebuildTransaction({ sourceAddress, operations, signers, memo, timeout }) {
  if (!sourceAddress || !operations || !signers) return null;
  const account = await server.loadAccount(sourceAddress);

  let builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const ops = Array.isArray(operations) ? operations : [operations];
  for (const op of ops) {
    builder = builder.addOperation(op);
  }

  if (memo) {
    builder = builder.addMemo(require('stellar-sdk').Memo.text(memo));
  }

  builder = builder.setTimeout(timeout || DEFAULT_TIMEOUT);
  const tx = builder.build();

  const signerList = Array.isArray(signers) ? signers : [signers];
  for (const signer of signerList) {
    tx.sign(signer);
  }

  return tx;
}


async function submitHorizonTransaction(transaction, { refreshSequenceAndRebuildOnce }) {
  const maxTimeoutRetries = 3;
  let timeoutAttempt = 0;


  // Attempt loop only for timeout errors.
  while (true) {
    try {
      return await server.submitTransaction(transaction);
    } catch (err) {
      const horizonBody = extractHorizonResponseBody(err);
      logger.error('[stellarTransactionService] Horizon submission error', {
        message: err?.message,
        code: findPrimaryHorizonCode(err),
        horizonBody,
      });

      const codes = extractResultCodes(err);

      // Acceptance criteria: tx_bad_seq => refresh sequence and one retry.
      if (codes.includes('tx_bad_seq') && typeof refreshSequenceAndRebuildOnce === 'function') {
        const rebuiltTx = await refreshSequenceAndRebuildOnce();
        if (rebuiltTx) {
          // After refresh/rebuild, retry the submission once.
          transaction = rebuiltTx;
          continue;
        }
      }

      // Acceptance criteria: insufficient_balance => map to 400.
      if (isInsufficientBalance(err)) {
        const code = findPrimaryHorizonCode(err);
        const e = createError('Insufficient balance', 400, code);
        e.horizonBody = horizonBody;
        throw e;
      }

      // Acceptance criteria: timeout => retry up to 3 times with exponential backoff.
      if (isHorizonTimeout(err) && timeoutAttempt < maxTimeoutRetries - 1) {
        const backoffMs = Math.pow(2, timeoutAttempt) * 500; // 0.5s, 1s, 2s
        timeoutAttempt += 1;
        await sleep(backoffMs);
        continue;
      }

      // Acceptance criteria: all other Horizon errors => 503 with original error code.
      const originalCode = findPrimaryHorizonCode(err);
      const e = createError('Horizon error', 503, originalCode);
      e.horizonBody = horizonBody;
      throw e;
    }
  }
}


/**
 * Parses a successful Horizon submission result into a structured object.
 *
 * @param {object} horizonResult - Raw Horizon response
 * @returns {{ txHash: string, ledger: number, status: string, resultXdr: string, successful: boolean }}
 */
function parseTransactionResult(horizonResult) {
  return {
    txHash: horizonResult.hash,
    ledger: horizonResult.ledger,
    status: horizonResult.successful ? 'completed' : 'failed',
    resultXdr: horizonResult.result_xdr || null,
    successful: horizonResult.successful,
  };
}

/**
 * Stores the transaction result in the database.
 *
 * @param {{ txHash: string, ledger: number, status: string, resultXdr: string }} result
 * @param {object} options
 */
async function storeTransactionResult(result, options = {}) {
  try {
    await recordTransaction({
      txHash: result.txHash,
      txType: options.txType || 'transfer',
      amount: options.amount || '0',
      fromWallet: options.fromWallet || null,
      toWallet: options.toWallet || null,
      merchantId: options.merchantId || null,
      campaignId: options.campaignId || null,
      userId: options.userId || null,
      stellarLedger: result.ledger,
      status: result.status === 'submitted' ? 'completed' : result.status,
      metadata: {
        ...options.metadata,
        resultXdr: result.resultXdr,
      },
    });
  } catch (dbErr) {
    // Log but don't fail the response — the tx was already submitted on-chain
    logger.error('[stellarTransactionService] Failed to store transaction result:', dbErr.message);
  }
}

// ---------------------------------------------------------------------------
// Fetch current sequence number (exposed for external consumers)
// ---------------------------------------------------------------------------

/**
 * Fetches the current sequence number for a Stellar account from Horizon.
 *
 * @param {string} publicKey - Stellar public key
 * @returns {Promise<string>} Sequence number as a string
 */
async function getSequenceNumber(publicKey) {
  const account = await server.loadAccount(publicKey);
  return account.sequence;
}

module.exports = {
  submit,
  submitFeeBump,
  submitFeeBumpTransaction,
  parseTransactionResult,
  extractResultCodes,
  getSequenceNumber,
  storeTransactionResult,
  NETWORK_PASSPHRASE,
  STUCK_RESULT_CODES,
  FEE_BUMP_MULTIPLIER,
  MAX_FEE_BUMP_ATTEMPTS,
};
