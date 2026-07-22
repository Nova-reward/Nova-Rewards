'use strict';

/**
 * Unit tests for tokenTransferService.js — POST /api/tokens/transfer business logic.
 * Closes #863
 *
 * Horizon/DB calls are faked out via the service's `_deps` seam rather than
 * jest/vi module mocking: this codebase's Vitest setup does not intercept
 * require() calls made from inside a CommonJS module under test (only
 * mocks registered against the test file's own ESM import graph apply), so
 * jest.mock()/vi.mock() on '../../blockchain/stellarService' etc. silently
 * fall through to the real network here. `_deps` avoids that entirely.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
const { Keypair } = require('stellar-sdk');

const tokenTransferService = require('../services/tokenTransferService');
const { transferTokens, _deps } = tokenTransferService;

const SENDER_KEYPAIR = Keypair.random();
const SENDER_ADDRESS = SENDER_KEYPAIR.publicKey();
const VALID_SECRET = SENDER_KEYPAIR.secret();
const VALID_DESTINATION = Keypair.random().publicKey();

function baseParams(overrides = {}) {
  return {
    userId: 1,
    walletAddress: SENDER_ADDRESS,
    destination: VALID_DESTINATION,
    amount: '10.5',
    signerSecret: VALID_SECRET,
    ...overrides,
  };
}

describe('transferTokens', () => {
  beforeEach(() => {
    _deps.getNOVABalance = vi.fn().mockResolvedValue('100.0000000');
    _deps.verifyTrustline = vi.fn().mockResolvedValue({ exists: true });
    _deps.submit = vi.fn().mockResolvedValue({
      txHash: 'abctxhash',
      ledger: 12345,
      status: 'submitted',
      resultXdr: 'xdr',
    });
  });

  it('successfully transfers and returns tx hash + updated balance', async () => {
    _deps.getNOVABalance
      .mockResolvedValueOnce('100.0000000') // pre-check
      .mockResolvedValueOnce('89.5000000'); // post-submit

    const result = await transferTokens(baseParams());

    expect(result).toMatchObject({
      txHash: 'abctxhash',
      ledger: 12345,
      status: 'submitted',
      amount: '10.5',
      fromWallet: SENDER_ADDRESS,
      toWallet: VALID_DESTINATION,
      balance: '89.5000000',
    });

    expect(_deps.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAddress: SENDER_ADDRESS,
        options: expect.objectContaining({
          txType: 'transfer',
          amount: '10.5',
          fromWallet: SENDER_ADDRESS,
          toWallet: VALID_DESTINATION,
          userId: 1,
        }),
      })
    );
  });

  it('throws 400 when the user has no linked wallet', async () => {
    await expect(transferTokens(baseParams({ walletAddress: undefined })))
      .rejects.toMatchObject({ status: 400, code: 'no_wallet_linked' });
  });

  it('throws 400 for a missing destination', async () => {
    await expect(transferTokens(baseParams({ destination: undefined })))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 for an invalid destination address', async () => {
    await expect(transferTokens(baseParams({ destination: 'not-an-address' })))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when destination equals the sender wallet', async () => {
    await expect(transferTokens(baseParams({ destination: SENDER_ADDRESS })))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when amount is missing', async () => {
    await expect(transferTokens(baseParams({ amount: undefined })))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when amount is zero', async () => {
    await expect(transferTokens(baseParams({ amount: '0' })))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when amount is negative', async () => {
    await expect(transferTokens(baseParams({ amount: '-5' })))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when amount has too many decimal places', async () => {
    await expect(transferTokens(baseParams({ amount: '1.12345678' })))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 for a malformed signerSecret', async () => {
    await expect(transferTokens(baseParams({ signerSecret: 'not-a-secret' })))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 403 when signerSecret does not match the linked wallet', async () => {
    const otherKeypair = Keypair.random();
    await expect(transferTokens(baseParams({ signerSecret: otherKeypair.secret() })))
      .rejects.toMatchObject({ status: 403, code: 'forbidden' });
  });

  it('throws 400 when the sender has insufficient balance', async () => {
    _deps.getNOVABalance.mockResolvedValueOnce('5.0000000');
    await expect(transferTokens(baseParams({ amount: '10' })))
      .rejects.toMatchObject({ status: 400, code: 'insufficient_balance' });
  });

  it('throws 400 when the destination has no NOVA trustline', async () => {
    _deps.verifyTrustline.mockResolvedValue({ exists: false });
    await expect(transferTokens(baseParams()))
      .rejects.toMatchObject({ status: 400, code: 'destination_no_trustline' });
    expect(_deps.submit).not.toHaveBeenCalled();
  });

  it('maps a Horizon op_underfunded submission failure to insufficient_balance', async () => {
    _deps.submit.mockRejectedValue(
      Object.assign(new Error('Transaction submission failed: op_underfunded'), { status: 400, code: 'tx_submission_failed' })
    );
    await expect(transferTokens(baseParams()))
      .rejects.toMatchObject({ status: 400, code: 'insufficient_balance' });
  });

  it('maps a Horizon op_no_destination submission failure to destination_not_found', async () => {
    _deps.submit.mockRejectedValue(
      Object.assign(new Error('Transaction submission failed: op_no_destination'), { status: 400, code: 'tx_submission_failed' })
    );
    await expect(transferTokens(baseParams()))
      .rejects.toMatchObject({ status: 400, code: 'destination_not_found' });
  });

  it('maps a Horizon op_no_trust submission failure to destination_no_trustline', async () => {
    _deps.submit.mockRejectedValue(
      Object.assign(new Error('Transaction submission failed: op_no_trust'), { status: 400, code: 'tx_submission_failed' })
    );
    await expect(transferTokens(baseParams()))
      .rejects.toMatchObject({ status: 400, code: 'destination_no_trustline' });
  });

  it('maps a Horizon op_line_full submission failure to destination_trustline_full', async () => {
    _deps.submit.mockRejectedValue(
      Object.assign(new Error('Transaction submission failed: op_line_full'), { status: 400, code: 'tx_submission_failed' })
    );
    await expect(transferTokens(baseParams()))
      .rejects.toMatchObject({ status: 400, code: 'destination_trustline_full' });
  });

  it('propagates unrecognized submission errors unchanged', async () => {
    _deps.submit.mockRejectedValue(
      Object.assign(new Error('Horizon error'), { status: 503, code: 'horizon_error' })
    );
    await expect(transferTokens(baseParams()))
      .rejects.toMatchObject({ status: 503, code: 'horizon_error' });
  });

  it('falls back to the pre-submission balance if the post-submit balance fetch fails', async () => {
    _deps.getNOVABalance
      .mockResolvedValueOnce('100.0000000')
      .mockRejectedValueOnce(new Error('Horizon down'));

    const result = await transferTokens(baseParams());
    expect(result.balance).toBe('100.0000000');
  });
});
