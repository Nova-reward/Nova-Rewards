import { Horizon } from 'stellar-sdk';

const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const server = new Horizon.Server(HORIZON_URL, { timeout: 15000 });

const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS       = 60_000;

export class TransactionTimeout extends Error {
  constructor(hash) {
    super(`Transaction ${hash} timed out after ${TIMEOUT_MS / 1000}s`);
    this.name = 'TransactionTimeout';
    this.hash = hash;
  }
}

export class TransactionExpired extends Error {
  constructor(hash) {
    super(`Transaction ${hash} sequence number too old — needs resubmission`);
    this.name = 'TransactionExpired';
    this.hash = hash;
  }
}

/**
 * Polls Horizon until a transaction is confirmed or failed.
 *
 * @param {string} hash - Stellar transaction hash
 * @param {function} [onStatus] - optional callback(status) for real-time updates
 *   status: 'pending' | 'confirming' | 'confirmed' | 'failed' | 'expired'
 * @returns {Promise<object>} Horizon transaction record
 * @throws {TransactionTimeout} after 60 s with no result
 * @throws {TransactionExpired} when sequence number is too old
 *
 * Issue #662
 */
export async function pollTransactionStatus(hash, onStatus) {
  const deadline = Date.now() + TIMEOUT_MS;
  onStatus?.('pending');

  while (Date.now() < deadline) {
    try {
      const tx = await server.transactions().transaction(hash).call();

      if (tx.successful === true) {
        onStatus?.('confirmed');
        return tx;
      }

      // Horizon marks failed txs with successful=false
      onStatus?.('failed');
      return tx;
    } catch (err) {
      const status = err?.response?.status;

      if (status === 404) {
        // Not yet on-chain — keep polling
        onStatus?.('confirming');
        await _sleep(POLL_INTERVAL_MS);
        continue;
      }

      // tx_bad_seq / sequence too old
      if (_isExpiredSequence(err)) {
        onStatus?.('expired');
        throw new TransactionExpired(hash);
      }

      throw err;
    }
  }

  throw new TransactionTimeout(hash);
}

function _isExpiredSequence(err) {
  const extras = err?.response?.data?.extras;
  if (!extras) return false;
  const codes = extras.result_codes;
  return (
    codes?.transaction === 'tx_bad_seq' ||
    (Array.isArray(codes?.operations) && codes.operations.includes('op_bad_seq'))
  );
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
