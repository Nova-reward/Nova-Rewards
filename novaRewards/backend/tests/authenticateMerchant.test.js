'use strict';

const { createHash } = require('crypto');
const merchantRepo = require('../db/merchantRepository');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

function mockReqRes(headers = {}) {
  const req = { headers };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('authenticateMerchant middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 with unauthorized error when x-api-key header is missing', async () => {
    const spy = vi.spyOn(merchantRepo, 'getMerchantByApiKeyHash');
    const { req, res, next } = mockReqRes({});

    await authenticateMerchant(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'unauthorized',
      message: 'x-api-key header is required',
    });
    expect(next).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns 401 with unauthorized error when x-api-key header is empty string', async () => {
    const { req, res, next } = mockReqRes({ 'x-api-key': '' });

    await authenticateMerchant(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'unauthorized',
      message: 'x-api-key header is required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with unauthorized error when merchant is not found in database', async () => {
    const spy = vi.spyOn(merchantRepo, 'getMerchantByApiKeyHash').mockResolvedValue(null);

    const validKey = 'nova_live_1234567890abcdef';
    const { req, res, next } = mockReqRes({ 'x-api-key': validKey });

    await authenticateMerchant(req, res, next);

    const expectedHash = createHash('sha256').update(validKey).digest('hex');
    expect(spy).toHaveBeenCalledWith(expectedHash);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'unauthorized',
      message: 'Invalid API key',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with unauthorized error when stored hash does not match computed hash', async () => {
    const validKey = 'nova_live_1234567890abcdef';
    const differentHash = createHash('sha256').update('different_key').digest('hex');

    vi.spyOn(merchantRepo, 'getMerchantByApiKeyHash').mockResolvedValue({
      id: 42,
      name: 'Acme Corp',
      api_key: differentHash,
    });

    const { req, res, next } = mockReqRes({ 'x-api-key': validKey });

    await authenticateMerchant(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'unauthorized',
      message: 'Invalid API key',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when stored merchant object has missing api_key property', async () => {
    vi.spyOn(merchantRepo, 'getMerchantByApiKeyHash').mockResolvedValue({
      id: 42,
      name: 'Acme Corp',
    });

    const { req, res, next } = mockReqRes({ 'x-api-key': 'nova_live_123' });

    await authenticateMerchant(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'unauthorized',
      message: 'Invalid API key',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches merchant to req and calls next on valid API key', async () => {
    const validKey = 'nova_live_secret_key_999';
    const hash = createHash('sha256').update(validKey).digest('hex');
    const mockMerchant = {
      id: 10,
      name: 'Super Merchant',
      wallet_address: 'GAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      api_key: hash,
    };

    const spy = vi.spyOn(merchantRepo, 'getMerchantByApiKeyHash').mockResolvedValue(mockMerchant);

    const { req, res, next } = mockReqRes({ 'x-api-key': validKey });

    await authenticateMerchant(req, res, next);

    expect(spy).toHaveBeenCalledWith(hash);
    expect(req.merchant).toBe(mockMerchant);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });

  it('passes uncaught repository errors to next(err)', async () => {
    const dbError = new Error('Database connection failed');
    vi.spyOn(merchantRepo, 'getMerchantByApiKeyHash').mockRejectedValue(dbError);

    const { req, res, next } = mockReqRes({ 'x-api-key': 'some_key' });

    await authenticateMerchant(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
  });
});
