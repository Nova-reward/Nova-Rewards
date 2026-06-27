'use strict';

const { Contract, Networks, TransactionBuilder, nativeToScVal, scValToNative, SorobanRpc } = require('stellar-sdk');
const { getConfig } = require('./configService');
const { withFailover } = require('./sorobanRpcService');

const GOVERNANCE_CONTRACT_ID = getConfig('GOVERNANCE_CONTRACT_ID');
const NETWORK_PASSPHRASE =
  getConfig('STELLAR_NETWORK', 'testnet') === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

function getSourceAccount(server) {
  const sourcePublic = getConfig('DISTRIBUTION_PUBLIC');
  return server.getAccount(sourcePublic);
}

function parseProposal(raw) {
  const statusMap = {
    Active: 'Active',
    Passed: 'Passed',
    Rejected: 'Rejected',
    Executed: 'Executed',
  };

  const status = statusMap[raw.status] || 'Unknown';

  let proposer = raw.proposer;
  if (typeof proposer === 'object' && proposer._value) {
    proposer = String(proposer._value);
  }

  return {
    id: Number(raw.id),
    title: String(raw.title),
    description: String(raw.description),
    votesFor: Number(raw.yes_votes),
    votesAgainst: Number(raw.no_votes),
    status,
    endTime: Number(raw.end_ledger),
  };
}

async function getProposalCount() {
  if (!GOVERNANCE_CONTRACT_ID) return 0;

  return withFailover(async (server) => {
    const source = await getSourceAccount(server);
    const contract = new Contract(GOVERNANCE_CONTRACT_ID);
    const tx = new TransactionBuilder(source, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('proposal_count'))
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(result)) {
      throw new Error(`proposal_count simulation failed: ${result.error}`);
    }
    return Number(scValToNative(result.result.retval));
  });
}

async function getProposal(id) {
  if (!GOVERNANCE_CONTRACT_ID) return null;

  return withFailover(async (server) => {
    const source = await getSourceAccount(server);
    const contract = new Contract(GOVERNANCE_CONTRACT_ID);
    const tx = new TransactionBuilder(source, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_proposal', nativeToScVal(id, { type: 'u32' })))
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(result)) {
      throw new Error(`get_proposal(${id}) simulation failed: ${result.error}`);
    }
    return parseProposal(scValToNative(result.result.retval));
  });
}

async function getAllProposals() {
  if (!GOVERNANCE_CONTRACT_ID) return [];

  const count = await getProposalCount();
  const proposals = [];
  for (let i = 1; i <= count; i++) {
    const proposal = await getProposal(i);
    if (proposal) proposals.push(proposal);
  }
  return proposals;
}

module.exports = { getAllProposals, getProposal, getProposalCount };
