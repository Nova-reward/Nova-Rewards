'use strict';

/**
 * Route tests for POST /api/tokens/transfer.
 * Closes #863
 *
 * tokenTransferService is stubbed directly (not via jest.mock/vi.mock —
 * see the note in tokenTransferService.test.js for why module mocking
 * doesn't intercept this codebase's CommonJS require() chains under the
 * current Vitest setup). Since routes/tokens.js accesses
 * `tokenTransferService.transferTokens` through the module object rather
 * than a destructured binding, swapping the property on the cached module
 * before each test is enough to control its behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
const request = require('supertest');
const express = require('express');

// routes/tokens.js destructures `{ authenticateUser }` at require time, so
// the real middleware must be replaced before the route module is required.
const authModule = require('../middleware/authenticateUser');
authModule.authenticateUser = (req, res, next) => {
  req.user = { id: 1, stellar_public_key: 'GSENDER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB' };
  next();
};

const tokenTransferService = require('../services/tokenTransferService');
const tokensRoutes = require('../routes/tokens');

const app = express();
app.use(express.json());
app.use('/api/tokens', tokensRoutes);

describe('POST /api/tokens/transfer', () => {
  beforeEach(() => {
    tokenTransferService.transferTokens = vi.fn();
  });

  it('returns the transfer result on success', async () => {
    tokenTransferService.transferTokens.mockResolvedValue({
      txHash: 'abctxhash',
      ledger: 12345,
      status: 'submitted',
      amount: '10.5',
      fromWallet: 'GSENDER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB',
      toWallet: 'GDEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE',
      balance: '89.5000000',
    });

    const res = await request(app)
      .post('/api/tokens/transfer')
      .send({ destination: 'GDEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE', amount: '10.5', signerSecret: 'SSECRET' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.txHash).toBe('abctxhash');
    expect(res.body.data.balance).toBe('89.5000000');
    expect(tokenTransferService.transferTokens).toHaveBeenCalledWith({
      userId: 1,
      walletAddress: 'GSENDER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB',
      destination: 'GDEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE',
      amount: '10.5',
      signerSecret: 'SSECRET',
      memo: undefined,
    });
  });

  it('returns the mapped status/code when the service rejects', async () => {
    tokenTransferService.transferTokens.mockRejectedValue(
      Object.assign(new Error('Insufficient NOVA balance for this transfer'), { status: 400, code: 'insufficient_balance' })
    );

    const res = await request(app)
      .post('/api/tokens/transfer')
      .send({ destination: 'GDEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE', amount: '10.5', signerSecret: 'SSECRET' })
      .expect(400);

    expect(res.body).toEqual({
      success: false,
      error: 'insufficient_balance',
      message: 'Insufficient NOVA balance for this transfer',
    });
  });

  it('returns 403 when the service reports a wallet mismatch', async () => {
    tokenTransferService.transferTokens.mockRejectedValue(
      Object.assign(new Error("signerSecret does not match the authenticated user's linked wallet"), { status: 403, code: 'forbidden' })
    );

    const res = await request(app)
      .post('/api/tokens/transfer')
      .send({ destination: 'GDEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE', amount: '10.5', signerSecret: 'SSECRET' })
      .expect(403);

    expect(res.body.error).toBe('forbidden');
  });

  it('forwards unrecognized errors to the error-handling middleware', async () => {
    tokenTransferService.transferTokens.mockRejectedValue(new Error('boom'));

    let caughtErr = null;
    const appWithHandler = express();
    appWithHandler.use(express.json());
    appWithHandler.use('/api/tokens', tokensRoutes);
    appWithHandler.use((err, req, res, next) => {
      caughtErr = err;
      res.status(500).json({ success: false, error: 'server_error' });
    });

    const res = await request(appWithHandler)
      .post('/api/tokens/transfer')
      .send({ destination: 'GDEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE', amount: '10.5', signerSecret: 'SSECRET' })
      .expect(500);

    expect(res.body.error).toBe('server_error');
    expect(caughtErr.message).toBe('boom');
  });
});
