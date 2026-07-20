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
 * Submits a transaction, and if it's stuck (bad_seq, insufficient_fee, too_late),
 * retries with a fee-bump transaction up to MAX_FEE_BUMP_ATTEMPTS times.
 *
 * @param {import('stellar-sdk').Transaction} transaction
 * @param {object} options
 * @returns {Promise<{ txHash: string, ledger: number, status: string, resultXdr: string }>}
 */
async function submitWithFeeBumpRetry(transaction, options = {}) {
  let lastError;

  // Acceptance criteria: Horizon tx_bad_seq triggers a sequence refresh and one retry.
  let didRefreshSequenceRetry = false;

  const submitContext = {
    sourceAddress: options?.sourceAddress,
    transaction,
    operations: options?.operations,
    signers: options?.signers,
    feeSourceSecret: options?.feeSourceSecret,
    timeout: options?.timeout,
    memo: options?.memo,
    txType: options?.txType,
  };

  for (let attempt = 0; attempt <= MAX_FEE_BUMP_ATTEMPTS; attempt++) {
    try {
      const horizonResult = await submitHorizonTransaction(transaction, {
        options,
        didRefreshSequenceRetry,
        refreshSequenceAndRebuildOnce: async () => {
          if (didRefreshSequenceRetry) return null;
          didRefreshSequenceRetry = true;
          return refreshAndRebuildTransaction(submitContext);
        },
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

      if (!isStuck || attempt >= MAX_FEE_BUMP_ATTEMPTS) {
        break;
      }

      // Keep existing fee-bump retry behavior for stuck tx_insufficient_fee/tx_too_late.
      const feeSourceSecret =
        options.feeSourceSecret || getRequiredConfig('FEE_SOURCE_SECRET');
      const feeSourceKeypair = Keypair.fromSecret(feeSourceSecret);
      const bumpedFee = String(
        parseInt(transaction.fee, 10) * FEE_BUMP_MULTIPLIER * (attempt + 1),
      );

      const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
        feeSourceKeypair,
        bumpedFee,
        transaction,
        NETWORK_PASSPHRASE,
      );
      feeBumpTx.sign(feeSourceKeypair);

      const feeBumpResult = await submitFeeBumpTransaction(feeBumpTx);
      return feeBumpResult;
    }
  }

  const resultCodes = extractResultCodes(lastError);
  throw createError(
    `Transaction submission failed: ${resultCodes.join(', ') || lastError.message}`,
    400,
    'tx_submission_failed',
  );
}




/**
 * Submits a fee-bump transaction to Horizon.
 *
 * @param {import('stellar-sdk').FeeBumpTransaction} feeBumpTx
 * @returns {Promise<{ txHash: string, ledger: number, status: string, resultXdr: string }>}
 */
async function submitFeeBumpTransaction(feeBumpTx) {
  try {
    const horizonResult = await server.submitTransaction(feeBumpTx);

    return {
      txHash: horizonResult.hash,
      ledger: horizonResult.ledger,
      status: 'submitted',
      resultXdr: horizonResult.result_xdr,
      _raw: horizonResult,
    };
  } catch (err) {
    const resultCodes = extractResultCodes(err);
    throw createError(
      `Fee-bump submission failed: ${resultCodes.join(', ') || err.message}`,
      400,
      'tx_fee_bump_failed',
    );
  }
}

/**
 * Explicitly submits a fee-bump for a previously submitted stuck transaction.
 *
 * @param {object} params
 * @param {string} params.innerTxXDR - The XDR of the original (stuck) transaction
 * @param {string} params.feeSourceSecret - Secret key of the account paying the fee
 * @param {string} [params.baseFee] - Base fee for the fee-bump (default: 2x current fee)
 * @returns {Promise<{ txHash: string, ledger: number, status: string, resultXdr: string }>}
 */
async function submitFeeBump({ innerTxXDR, feeSourceSecret, baseFee }) {
  if (!innerTxXDR) {
    throw createError('innerTxXDR is required', 400, 'validation_error');
  }

  if (!feeSourceSecret) {
    throw createError('feeSourceSecret is required', 400, 'validation_error');
  }

  const feeSourceKeypair = Keypair.fromSecret(feeSourceSecret);
  const innerTx = TransactionBuilder.fromXDR(innerTxXDR, NETWORK_PASSPHRASE);

  const effectiveBaseFee = baseFee || String(parseInt(BASE_FEE, 10) * FEE_BUMP_MULTIPLIER);

  const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
    feeSourceKeypair,
    effectiveBaseFee,
    innerTx,
    NETWORK_PASSPHRASE,
  );
  feeBumpTx.sign(feeSourceKeypair);

  return submitFeeBumpTransaction(feeBumpTx);
}

// ---------------------------------------------------------------------------
// Result parsing and DB storage
// ---------------------------------------------------------------------------

/**
 * Extracts Horizon result codes from a submission error.
 *
 * @param {Error} err
 * @returns {string[]}
 */
function extractResultCodes(err) {
  try {
    const extras = err?.response?.data?.extras;
    if (!extras) return [];

    const codes = extras.result_codes || {};
    const allCodes = [];

    if (Array.isArray(codes.transaction)) allCodes.push(...codes.transaction);
    if (Array.isArray(codes.operations)) allCodes.push(...codes.operations);

    // Some Horizon variants may return a flat transaction error code.
    if (typeof extras.result_code === 'string') allCodes.push(extras.result_code);

    return allCodes;
  } catch {
    return [];
  }
}

function extractHorizonResponseBody(err) {
  try {
    return err?.response?.data ?? null;
  } catch {
    return null;
  }
}

function isHorizonTimeout(err) {
  const msg = `${err?.message || ''}`.toLowerCase();
  const code = `${err?.code || ''}`.toLowerCase();

  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    code.includes('etimedout') ||
    code.includes('timeout')
  );
}

function isInsufficientBalance(err) {
  const codes = extractResultCodes(err);
  return codes.some((c) => c === 'insufficient_balance' || c === 'tx_insufficient_balance');
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
