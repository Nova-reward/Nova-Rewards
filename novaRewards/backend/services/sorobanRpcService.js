'use strict';

const { SorobanRpc, xdr } = require('stellar-sdk');
const { getConfig } = require('./configService');
const { getRedisClient } = require('../cache/redisClient');

const LEDGER_ENTRY_TTL_SECONDS = 10;

/**
 * Returns an ordered list of RPC endpoint URLs.
 * PRIMARY: SOROBAN_RPC_URL  (required in production)
 * FALLBACK: SOROBAN_RPC_URL_FALLBACK (optional)
 */
function getRpcUrls() {
  const primary = getConfig('SOROBAN_RPC_URL', 'https://soroban-testnet.stellar.org');
  const fallback = getConfig('SOROBAN_RPC_URL_FALLBACK', '');
  return fallback ? [primary, fallback] : [primary];
}

function buildServer(url) {
  return new SorobanRpc.Server(url, { allowHttp: url.startsWith('http://') });
}

/**
 * Tries each RPC endpoint in order, returning the result of the first that succeeds.
 *
 * @template T
 * @param {(server: SorobanRpc.Server) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withFailover(fn) {
  const urls = getRpcUrls();
  let lastErr;
  for (const url of urls) {
    try {
      return await fn(buildServer(url));
    } catch (err) {
      lastErr = err;
      console.warn(`[SorobanRpcService] RPC ${url} failed: ${err.message}. Trying next…`);
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Simulates a transaction against the Soroban RPC.
 * Used for fee estimation before submission.
 *
 * @param {import('stellar-sdk').Transaction} transaction
 * @returns {Promise<SorobanRpc.Api.SimulateTransactionResponse>}
 */
async function simulateTransaction(transaction) {
  return withFailover((server) => server.simulateTransaction(transaction));
}

/**
 * Fetches a single contract data entry by contract ID and key.
 * Results are cached in Redis for LEDGER_ENTRY_TTL_SECONDS seconds.
 *
 * @param {string} contractId  - Strkey-encoded contract address
 * @param {xdr.ScVal} key      - Storage key as ScVal
 * @returns {Promise<SorobanRpc.Api.LedgerEntryResult | null>}
 */
async function getContractData(contractId, key) {
  const redis = getRedisClient();
  const cacheKey = `soroban:contract:${contractId}:${key.toXDR('base64')}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const ledgerKey = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: xdr.ScAddress.scAddressTypeContract(
        xdr.Hash.fromXDR(Buffer.from(contractId, 'hex'))
      ),
      key,
      durability: xdr.ContractDataDurability.persistent(),
    })
  );

  const result = await withFailover((server) => server.getLedgerEntries(ledgerKey));
  const entry = result.entries[0] ?? null;

  if (redis && entry) {
    await redis.setex(cacheKey, LEDGER_ENTRY_TTL_SECONDS, JSON.stringify(entry));
  }

  return entry;
}

/**
 * Fetches multiple ledger entries in a single RPC call.
 * Results are cached in Redis for LEDGER_ENTRY_TTL_SECONDS seconds.
 *
 * @param {...xdr.LedgerKey} keys
 * @returns {Promise<SorobanRpc.Api.GetLedgerEntriesResponse>}
 */
async function getLedgerEntries(...keys) {
  const redis = getRedisClient();
  const cacheKey = `soroban:ledger:${keys.map((k) => k.toXDR('base64')).join(',')}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const result = await withFailover((server) => server.getLedgerEntries(...keys));

  if (redis) {
    await redis.setex(cacheKey, LEDGER_ENTRY_TTL_SECONDS, JSON.stringify(result));
  }

  return result;
}

module.exports = { simulateTransaction, getContractData, getLedgerEntries };
