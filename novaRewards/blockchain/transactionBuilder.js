'use strict';

require('dotenv').config();
const {
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE,
  Contract,
  SorobanRpc,
} = require('stellar-sdk');
const { server } = require('./stellarService');

const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

const DEFAULT_TIMEOUT = 30;
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15; // ~30 s

/**
 * Builds a signed Soroban contract invocation transaction.
 *
 * @param {{ contractId: string, method: string, args?: import('stellar-sdk').xdr.ScVal[], sourceKeypair: import('stellar-sdk').Keypair, account?: import('stellar-sdk').Account, rpcServer?: object, assembleFn?: Function }} opts
 * @returns {Promise<import('stellar-sdk').Transaction>}
 */
async function buildContractInvocation({ contractId, method, args = [], sourceKeypair, account, rpcServer, assembleFn }) {
  const acc = account || (await server.loadAccount(sourceKeypair.publicKey()));
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(acc, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(DEFAULT_TIMEOUT)
    .build();

  const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
  const rpc = rpcServer || new SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const assemble = assembleFn || SorobanRpc.assembleTransaction;

  const simResult = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Soroban simulation failed: ${simResult.error}`);
  }

  const prepared = assemble(tx, simResult).build();
  prepared.sign(sourceKeypair);
  return prepared;
}

/**
 * Builds a signed Stellar asset payment transaction.
 *
 * @param {{ sourceKeypair: import('stellar-sdk').Keypair, destination: string, asset: import('stellar-sdk').Asset, amount: string, account?: import('stellar-sdk').Account }} opts
 * @returns {Promise<import('stellar-sdk').Transaction>}
 */
async function buildAssetTransfer({ sourceKeypair, destination, asset, amount, account }) {
  const acc = account || (await server.loadAccount(sourceKeypair.publicKey()));

  const tx = new TransactionBuilder(acc, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.payment({ destination, asset, amount: String(amount) }))
    .setTimeout(DEFAULT_TIMEOUT)
    .build();

  tx.sign(sourceKeypair);
  return tx;
}

/**
 * Wraps an existing signed transaction in a fee-bump envelope.
 *
 * @param {{ feeSourceKeypair: import('stellar-sdk').Keypair, innerTx: import('stellar-sdk').Transaction, baseFee?: string }} opts
 * @returns {import('stellar-sdk').FeeBumpTransaction}
 */
function buildFeeBump({ feeSourceKeypair, innerTx, baseFee = '200' }) {
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    feeSourceKeypair,
    baseFee,
    innerTx,
    NETWORK_PASSPHRASE,
  );
  feeBump.sign(feeSourceKeypair);
  return feeBump;
}

/**
 * Submits a transaction to Horizon and polls until confirmed or timed out.
 *
 * @param {import('stellar-sdk').Transaction | import('stellar-sdk').FeeBumpTransaction} tx
 * @param {{ pollIntervalMs?: number, maxAttempts?: number }} [opts]
 * @returns {Promise<{ txHash: string, ledger: number }>}
 */
async function submitWithPolling(tx, { pollIntervalMs = POLL_INTERVAL_MS, maxAttempts = POLL_MAX_ATTEMPTS } = {}) {
  const result = await server.submitTransaction(tx);
  const txHash = result.hash;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    try {
      const record = await server.transactions().transaction(txHash).call();
      if (record.successful) return { txHash, ledger: record.ledger };
      const err = new Error(`Transaction failed on ledger ${record.ledger}`);
      err.code = 'tx_failed';
      err.resultXdr = record.result_xdr;
      throw err;
    } catch (pollErr) {
      if (pollErr.response && pollErr.response.status === 404) continue;
      throw pollErr;
    }
  }

  const err = new Error(`Transaction ${txHash} not confirmed after ${maxAttempts} attempts`);
  err.code = 'tx_timeout';
  err.txHash = txHash;
  throw err;
}

module.exports = { buildContractInvocation, buildAssetTransfer, buildFeeBump, submitWithPolling };
