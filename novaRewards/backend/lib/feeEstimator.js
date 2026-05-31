'use strict';

/**
 * Fee Estimator Utility
 *
 * Simulates a Soroban contract invocation against the Stellar RPC
 * simulateTransaction endpoint and returns a structured fee breakdown
 * before the transaction is submitted.
 *
 * Fee anatomy:
 *  - resourceFee   : Soroban resource fee (CPU, memory, ledger I/O) — from simResult.minResourceFee
 *  - inclusionFee  : Base network inclusion fee (stroops) — configurable, defaults to BASE_FEE (100)
 *  - totalFee      : resourceFee + inclusionFee
 *
 * All fee values are returned as strings (stroops) to avoid floating-point issues.
 */

const {
  Contract,
  Networks,
  TransactionBuilder,
  Account,
  SorobanRpc,
  BASE_FEE,
  nativeToScVal,
  xdr,
} = require('stellar-sdk');
const { getConfig } = require('../services/configService');
const { simulateTransaction } = require('../services/sorobanRpcService');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NETWORK_PASSPHRASE =
  getConfig('STELLAR_NETWORK', 'testnet') === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

/**
 * A well-known placeholder source account used only for simulation.
 * Simulation does not validate sequence numbers or auth, so any valid
 * account format works. We use sequence "0" to avoid any Horizon lookup.
 */
const SIMULATION_SOURCE_ACCOUNT = new Account(
  getConfig(
    'SOROBAN_SIMULATION_SOURCE',
    'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  ),
  '0',
);

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FeeEstimate
 * @property {string} resourceFee   - Soroban resource fee in stroops
 * @property {string} inclusionFee  - Network inclusion fee in stroops
 * @property {string} totalFee      - Total fee in stroops (resource + inclusion)
 * @property {string} contractId    - The contract that was simulated
 * @property {string} functionName  - The function that was simulated
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Encodes a raw JS argument to an xdr.ScVal.
 * Accepts pre-encoded ScVal instances (pass-through), strings, numbers,
 * bigints, booleans, and null.
 *
 * @param {*} arg
 * @returns {xdr.ScVal}
 */
function encodeArg(arg) {
  if (arg instanceof xdr.ScVal) return arg;
  return nativeToScVal(arg);
}

// ---------------------------------------------------------------------------
// Core: estimate_fee
// ---------------------------------------------------------------------------

/**
 * Estimates the fee for a Soroban contract invocation without submitting it.
 *
 * @param {object} params
 * @param {string}   params.contractId    - Strkey-encoded contract address (C…)
 * @param {string}   params.functionName  - Contract function to invoke
 * @param {Array}    [params.args=[]]     - Function arguments (native JS values or xdr.ScVal)
 * @param {string}   [params.inclusionFee=BASE_FEE] - Inclusion fee in stroops (default: 100)
 * @param {object}   [params._rpcOverride]  - Injected RPC function for testing
 * @returns {Promise<FeeEstimate>}
 * @throws {Error} If simulation fails or returns an error response
 */
async function estimate_fee({
  contractId,
  functionName,
  args = [],
  inclusionFee = BASE_FEE,
  _rpcOverride,
}) {
  if (!contractId || typeof contractId !== 'string') {
    throw Object.assign(new Error('contractId is required'), { code: 'validation_error', status: 400 });
  }
  if (!functionName || typeof functionName !== 'string') {
    throw Object.assign(new Error('functionName is required'), { code: 'validation_error', status: 400 });
  }
  if (!Array.isArray(args)) {
    throw Object.assign(new Error('args must be an array'), { code: 'validation_error', status: 400 });
  }

  const encodedArgs = args.map(encodeArg);
  const contract = new Contract(contractId);

  // Build a simulation-only transaction. Sequence number and fee are
  // irrelevant for simulation; the RPC ignores them.
  const tx = new TransactionBuilder(SIMULATION_SOURCE_ACCOUNT, {
    fee: inclusionFee,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...encodedArgs))
    .setTimeout(30)
    .build();

  // Use injected RPC for tests, otherwise use the shared sorobanRpcService
  const simulate = _rpcOverride || simulateTransaction;
  const simResult = await simulate(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    const err = new Error(`Simulation failed: ${simResult.error}`);
    err.code = 'simulation_error';
    err.status = 502;
    throw err;
  }

  // minResourceFee is a string in stroops returned by the RPC
  const resourceFeeStr = simResult.minResourceFee ?? '0';
  const inclusionFeeStr = String(inclusionFee);

  const resourceFee = BigInt(resourceFeeStr);
  const inclusionFeeBig = BigInt(inclusionFeeStr);
  const totalFee = resourceFee + inclusionFeeBig;

  return {
    resourceFee: resourceFee.toString(),
    inclusionFee: inclusionFeeBig.toString(),
    totalFee: totalFee.toString(),
    contractId,
    functionName,
  };
}

module.exports = { estimate_fee };
