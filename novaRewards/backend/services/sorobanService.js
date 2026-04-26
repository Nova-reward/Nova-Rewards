const {
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  SorobanRpc,
  Keypair,
  xdr,
} = require('stellar-sdk');
const { getConfig, getRequiredConfig } = require('./configService');

const NETWORK_PASSPHRASE =
  getConfig('STELLAR_NETWORK', 'TESTNET') === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

const RPC_URL = getConfig('SOROBAN_RPC_URL', 'https://soroban-testnet.stellar.org');
const CAMPAIGN_CONTRACT_ID = getConfig('CAMPAIGN_CONTRACT_ID');

/**
 * Returns a SorobanRpc.Server instance.
 * Lazy so tests can override SOROBAN_RPC_URL before requiring this module.
 */
function getRpcServer() {
  return new SorobanRpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
}

/**
 * Builds, simulates, and submits a Soroban contract invocation.
 *
 * @param {string} method   - Contract function name
 * @param {xdr.ScVal[]} args - Encoded arguments
 * @returns {Promise<{ txHash: string, contractCampaignId: string|null }>}
 */
async function invokeContract(method, args) {
  if (!CAMPAIGN_CONTRACT_ID) {
    throw new Error('CAMPAIGN_CONTRACT_ID env var is not set');
  }

  const secretKey = getRequiredConfig('SOROBAN_SIGNER_SECRET');
  const keypair = Keypair.fromSecret(secretKey);
  const server = getRpcServer();

  const account = await server.getAccount(keypair.publicKey());
  const contract = new Contract(CAMPAIGN_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Simulate to get the footprint / resource fees
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Soroban simulation failed: ${simResult.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  preparedTx.sign(keypair);

  const sendResult = await server.sendTransaction(preparedTx);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Soroban submission failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  // Poll until the transaction is confirmed or fails
  const txHash = sendResult.hash;
  let getResult;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    getResult = await server.getTransaction(txHash);
    if (getResult.status !== SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) break;
  }

  if (getResult.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Soroban transaction failed: ${getResult.status}`);
  }

  // Extract the return value (contract campaign id) if present
  let contractCampaignId = null;
  if (getResult.returnValue) {
    try {
      contractCampaignId = String(scValToNative(getResult.returnValue));
    } catch (_) {
      // non-critical — id may not be returned by all methods
    }
  }

  return { txHash, contractCampaignId };
}

/**
 * Registers a new campaign on-chain.
 *
 * @param {{ id: number, name: string, rewardRate: number, startDate: string, endDate: string }} campaign
 * @returns {Promise<{ txHash: string, contractCampaignId: string|null }>}
 */
async function registerCampaign(campaign) {
  const args = [
    nativeToScVal(campaign.id, { type: 'u64' }),
    nativeToScVal(campaign.name, { type: 'string' }),
    nativeToScVal(Number(campaign.rewardRate), { type: 'i128' }),
  ];
  return invokeContract('register_campaign', args);
}

/**
 * Updates mutable campaign fields on-chain.
 *
 * @param {{ contractCampaignId: string, name?: string, rewardRate?: number }} params
 * @returns {Promise<{ txHash: string, contractCampaignId: string|null }>}
 */
async function updateCampaign({ contractCampaignId, name, rewardRate }) {
  const args = [
    nativeToScVal(contractCampaignId, { type: 'string' }),
    name !== undefined ? nativeToScVal(name, { type: 'string' }) : nativeToScVal(null),
    rewardRate !== undefined ? nativeToScVal(Number(rewardRate), { type: 'i128' }) : nativeToScVal(null),
  ];
  return invokeContract('update_campaign', args);
}

/**
 * Pauses a campaign on-chain (used for soft-delete).
 *
 * @param {string} contractCampaignId
 * @returns {Promise<{ txHash: string, contractCampaignId: string|null }>}
 */
async function pauseCampaign(contractCampaignId) {
  const args = [nativeToScVal(contractCampaignId, { type: 'string' })];
  return invokeContract('pause_campaign', args);
}

module.exports = { registerCampaign, updateCampaign, pauseCampaign };
