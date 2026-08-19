'use strict';

/**
 * Unit tests for governanceService.js — Soroban governance contract reads.
 * Closes #1242
 *
 * Coverage: getProposalCount, getProposal (incl. the parseProposal field
 * mapping and status normalisation, exercised indirectly), RPC simulation
 * error paths, withFailover passing a server instance to the inner callback,
 * and graceful degradation when GOVERNANCE_CONTRACT_ID is unset.
 *
 * Mocking strategy (important): this repo's Vitest setup does NOT intercept
 * require() calls made from inside a CommonJS module under test — vi.mock()
 * only applies to the test file's own ESM import graph (see the note in
 * tests/tokenTransferService.test.js). Since governanceService reads
 * GOVERNANCE_CONTRACT_ID at module load time, we:
 *   1. stub ../services/sorobanRpcService by writing a fake module into
 *      Node's require.cache so governanceService's require() picks it up,
 *   2. inject a `SorobanRpc` alias into the cached stellar-sdk module
 *      (stellar-sdk >= 13 exposes the RPC namespace as `rpc`, while the
 *      service code still destructures the legacy `SorobanRpc` name), and
 *   3. delete governanceService from require.cache before each load so it
 *      re-executes with fresh env vars.
 * No production code is modified.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Env vars read at module load (globalSetup injects these; set explicitly
//    so this suite is self-contained) ────────────────────────────────────────
process.env.STELLAR_NETWORK     = 'testnet';
process.env.HORIZON_URL         = 'https://horizon-testnet.stellar.org';
process.env.DISTRIBUTION_PUBLIC = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

const REAL_SDK = require('stellar-sdk');
const { Account, Keypair, Transaction, nativeToScVal } = REAL_SDK;

const CONTRACT_ID         = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
const DISTRIBUTION_PUBLIC = process.env.DISTRIBUTION_PUBLIC;
// DISTRIBUTION_PUBLIC above is only used as a plain string (getAccount is
// stubbed); the Account handed back to the transaction builder must be a real
// valid key.
const ACCOUNT_PUBLIC = Keypair.random().publicKey();

const SDK_PATH     = require.resolve('stellar-sdk');
const SERVICE_PATH = require.resolve('../services/governanceService');
const RPC_PATH     = require.resolve('../services/sorobanRpcService');

// ── Fake SorobanRpc.Server handed to the inner withFailover callback ────────
const mockServer = vi.hoisted(() => ({
  getAccount: vi.fn(),
  simulateTransaction: vi.fn(),
}));

// stellar-sdk >= 13 moved the RPC namespace from `SorobanRpc` to `rpc`; the
// service still destructures the legacy name, so expose it as an alias.
function patchSdk() {
  require.cache[SDK_PATH] = {
    id: SDK_PATH,
    filename: SDK_PATH,
    loaded: true,
    exports: { ...REAL_SDK, SorobanRpc: REAL_SDK.SorobanRpc || REAL_SDK.rpc },
  };
}

function stubSorobanRpcService() {
  require.cache[RPC_PATH] = {
    id: RPC_PATH,
    filename: RPC_PATH,
    loaded: true,
    exports: { withFailover: vi.fn((fn) => fn(mockServer)) },
  };
}

function loadService({ contractId = CONTRACT_ID } = {}) {
  patchSdk();
  stubSorobanRpcService();
  delete require.cache[SERVICE_PATH];
  if (contractId) process.env.GOVERNANCE_CONTRACT_ID = contractId;
  else delete process.env.GOVERNANCE_CONTRACT_ID;
  return require('../services/governanceService');
}

function simulateSuccess(retval) {
  return { result: { retval } };
}

function proposalScVal(overrides = {}) {
  return nativeToScVal({
    id: 1,
    title: 'Proposal 1',
    description: 'A test proposal',
    yes_votes: 100,
    no_votes: 50,
    status: 'Active',
    end_ledger: 1000,
    proposer: { _value: DISTRIBUTION_PUBLIC },
    ...overrides,
  });
}

beforeEach(() => {
  mockServer.getAccount
    .mockReset()
    .mockResolvedValue(new Account(ACCOUNT_PUBLIC, '100'));
  mockServer.simulateTransaction.mockReset();
});

afterEach(() => {
  delete require.cache[SERVICE_PATH];
  delete process.env.GOVERNANCE_CONTRACT_ID;
});

// =============================================================================
// Graceful degradation when GOVERNANCE_CONTRACT_ID is unset
// =============================================================================
describe('governanceService without GOVERNANCE_CONTRACT_ID', () => {
  it('getProposalCount returns 0', async () => {
    const service = loadService({ contractId: null });
    await expect(service.getProposalCount()).resolves.toBe(0);
  });

  it('getProposal returns null', async () => {
    const service = loadService({ contractId: null });
    await expect(service.getProposal(1)).resolves.toBeNull();
  });

  it('getAllProposals returns an empty array', async () => {
    const service = loadService({ contractId: null });
    await expect(service.getAllProposals()).resolves.toEqual([]);
  });

  it('never touches the RPC server', async () => {
    const service = loadService({ contractId: null });
    await service.getProposalCount();
    await service.getProposal(1);
    await service.getAllProposals();

    expect(mockServer.getAccount).not.toHaveBeenCalled();
    expect(mockServer.simulateTransaction).not.toHaveBeenCalled();
  });
});

// =============================================================================
// getProposalCount
// =============================================================================
describe('getProposalCount', () => {
  it('returns the count reported by the contract', async () => {
    const service = loadService();
    mockServer.simulateTransaction.mockResolvedValue(simulateSuccess(nativeToScVal(3)));

    await expect(service.getProposalCount()).resolves.toBe(3);
  });

  it('throws when the proposal_count simulation reports an error', async () => {
    const service = loadService();
    mockServer.simulateTransaction.mockResolvedValue({ error: 'rpc exploded' });

    await expect(service.getProposalCount()).rejects.toThrow(
      'proposal_count simulation failed: rpc exploded'
    );
  });

  it('invokes the inner withFailover callback with a server instance', async () => {
    const service = loadService();
    mockServer.simulateTransaction.mockResolvedValue(simulateSuccess(nativeToScVal(3)));

    await service.getProposalCount();

    expect(mockServer.getAccount).toHaveBeenCalledWith(DISTRIBUTION_PUBLIC);
    expect(mockServer.simulateTransaction).toHaveBeenCalledWith(expect.any(Transaction));
  });
});

// =============================================================================
// getProposal — mapping + parseProposal normalisation (tested indirectly)
// =============================================================================
describe('getProposal', () => {
  it('maps yes_votes/no_votes to votesFor/votesAgainst and other fields', async () => {
    const service = loadService();
    mockServer.simulateTransaction.mockResolvedValue(simulateSuccess(proposalScVal()));

    const proposal = await service.getProposal(1);

    expect(proposal).toEqual({
      id: 1,
      title: 'Proposal 1',
      description: 'A test proposal',
      votesFor: 100,
      votesAgainst: 50,
      status: 'Active',
      endTime: 1000,
    });
  });

  it.each(['Active', 'Passed', 'Rejected', 'Executed'])(
    'normalises status "%s" unchanged',
    async (status) => {
      const service = loadService();
      mockServer.simulateTransaction.mockResolvedValue(
        simulateSuccess(proposalScVal({ status }))
      );

      const proposal = await service.getProposal(1);
      expect(proposal.status).toBe(status);
    }
  );

  it('maps unknown status strings to "Unknown"', async () => {
    const service = loadService();
    mockServer.simulateTransaction.mockResolvedValue(
      simulateSuccess(proposalScVal({ status: 'Vetoed' }))
    );

    const proposal = await service.getProposal(1);
    expect(proposal.status).toBe('Unknown');
  });

  it('throws when the get_proposal simulation reports an error', async () => {
    const service = loadService();
    mockServer.simulateTransaction.mockResolvedValue({ error: 'contract panic' });

    await expect(service.getProposal(7)).rejects.toThrow(
      'get_proposal(7) simulation failed: contract panic'
    );
  });
});

// =============================================================================
// getAllProposals
// =============================================================================
describe('getAllProposals', () => {
  it('aggregates the count and fetches every proposal', async () => {
    const service = loadService();
    mockServer.simulateTransaction
      .mockResolvedValueOnce(simulateSuccess(nativeToScVal(2)))
      .mockResolvedValueOnce(simulateSuccess(proposalScVal({ id: 1 })))
      .mockResolvedValueOnce(
        simulateSuccess(proposalScVal({ id: 2, title: 'Proposal 2' }))
      );

    const proposals = await service.getAllProposals();

    expect(proposals).toHaveLength(2);
    expect(proposals[0]).toMatchObject({ id: 1, title: 'Proposal 1' });
    expect(proposals[1]).toMatchObject({ id: 2, title: 'Proposal 2' });
  });

  it('returns an empty array when the contract reports zero proposals', async () => {
    const service = loadService();
    mockServer.simulateTransaction.mockResolvedValue(simulateSuccess(nativeToScVal(0)));

    await expect(service.getAllProposals()).resolves.toEqual([]);
  });
});
