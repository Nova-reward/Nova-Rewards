/**
 * Unit tests for novaRewards/backend/middleware/idempotency.js
 * Issue #1239
 *
 * Covers:
 *  - First request with a given key passes through normally and caches 2xx response
 *  - Second request with the same key returns 409 with the cached body
 *  - Missing / blank Idempotency-Key header returns 400
 *  - Expired key (Redis returns null) is treated as a new request
 *  - Redis error causes fail-open (request proceeds)
 *  - Non-2xx responses are NOT cached
 *
 * Mock strategy: uses vi.spyOn on the real redis client singleton — the pattern
 * that works reliably in this codebase's CJS+vitest environment.
 */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const redisModule = require('../lib/redis');
const loggerModule = require('../lib/logger');
const { idempotency } = require('../middleware/idempotency');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal Express-like req/res/next triple. */
function makeContext({ key, initialStatusCode = 200 } = {}) {
  const req = {
    headers: key !== undefined ? { 'idempotency-key': key } : {},
  };

  const res = {
    _statusCode: initialStatusCode,
    _body: null,
    get statusCode() { return this._statusCode; },
    set statusCode(code) { this._statusCode = code; },
    status(code) {
      this._statusCode = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };

  const next = vi.fn();
  return { req, res, next };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Missing / blank key  →  400
// ---------------------------------------------------------------------------

describe('missing or blank Idempotency-Key', () => {
  test('returns 400 when header is absent', () => {
    const { req, res, next } = makeContext({ key: undefined });
    idempotency(req, res, next);
    expect(res._statusCode).toBe(400);
    expect(res._body).toMatchObject({
      success: false,
      error: 'missing_idempotency_key',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 400 when header is an empty string', () => {
    const { req, res, next } = makeContext({ key: '' });
    idempotency(req, res, next);
    expect(res._statusCode).toBe(400);
    expect(res._body.error).toBe('missing_idempotency_key');
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 400 when header is whitespace only', () => {
    const { req, res, next } = makeContext({ key: '   ' });
    idempotency(req, res, next);
    expect(res._statusCode).toBe(400);
    expect(res._body.error).toBe('missing_idempotency_key');
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// First request  →  passes through and caches response
// ---------------------------------------------------------------------------

describe('first request with a new key', () => {
  test('calls next() when key is not in Redis (cache miss)', async () => {
    vi.spyOn(redisModule.client, 'get').mockResolvedValue(null);
    vi.spyOn(redisModule.client, 'set').mockResolvedValue('OK');

    const { req, res, next } = makeContext({ key: 'key-abc-001' });
    idempotency(req, res, next);
    await new Promise(r => setTimeout(r, 0));

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._statusCode).not.toBe(409);
  });

  test('caches the response body in Redis with correct key and TTL on 2xx', async () => {
    vi.spyOn(redisModule.client, 'get').mockResolvedValue(null);
    const setSpy = vi.spyOn(redisModule.client, 'set').mockResolvedValue('OK');

    const { req, res, next } = makeContext({ key: 'key-cache-write' });
    idempotency(req, res, next);
    await new Promise(r => setTimeout(r, 0));

    // Simulate handler calling res.json with a 200 response
    res._statusCode = 200;
    res.json({ success: true, txHash: 'abc123' });

    await new Promise(r => setTimeout(r, 0));

    expect(setSpy).toHaveBeenCalledWith(
      'idempotency:key-cache-write',
      JSON.stringify({ success: true, txHash: 'abc123' }),
      { EX: 86_400 },
    );
  });

  test('does NOT cache a non-2xx (error) response', async () => {
    vi.spyOn(redisModule.client, 'get').mockResolvedValue(null);
    const setSpy = vi.spyOn(redisModule.client, 'set').mockResolvedValue('OK');

    const { req, res, next } = makeContext({ key: 'key-error-nocache' });
    idempotency(req, res, next);
    await new Promise(r => setTimeout(r, 0));

    // Simulate a 400 response from the handler
    res._statusCode = 400;
    res.json({ success: false, error: 'validation_error' });

    await new Promise(r => setTimeout(r, 0));

    expect(setSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Duplicate request  →  409 with cached body
// ---------------------------------------------------------------------------

describe('duplicate request (key already in Redis)', () => {
  test('returns 409 Conflict with the original cached response body', async () => {
    const cachedResponse = { success: true, txHash: 'original-tx-hash' };
    vi.spyOn(redisModule.client, 'get').mockResolvedValue(JSON.stringify(cachedResponse));

    const { req, res, next } = makeContext({ key: 'key-duplicate' });
    idempotency(req, res, next);
    await new Promise(r => setTimeout(r, 0));

    expect(res._statusCode).toBe(409);
    expect(res._body).toEqual(cachedResponse);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 409 even when cached value is not JSON (graceful fallback)', async () => {
    vi.spyOn(redisModule.client, 'get').mockResolvedValue('plain-string-not-json');

    const { req, res, next } = makeContext({ key: 'key-broken-cache' });
    idempotency(req, res, next);
    await new Promise(r => setTimeout(r, 0));

    expect(res._statusCode).toBe(409);
    expect(res._body).toEqual({ raw: 'plain-string-not-json' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Expired key → treated as new request (Redis returns null)
// ---------------------------------------------------------------------------

describe('expired key (Redis TTL elapsed)', () => {
  test('proceeds normally when Redis returns null (key expired)', async () => {
    // After TTL expiry Redis returns null — identical to a brand-new key.
    vi.spyOn(redisModule.client, 'get').mockResolvedValue(null);
    vi.spyOn(redisModule.client, 'set').mockResolvedValue('OK');

    const { req, res, next } = makeContext({ key: 'key-expired' });
    idempotency(req, res, next);
    await new Promise(r => setTimeout(r, 0));

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._statusCode).not.toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Redis error  →  fail open
// ---------------------------------------------------------------------------

describe('Redis unavailable', () => {
  test('calls next() (fail open) when Redis.get throws', async () => {
    vi.spyOn(redisModule.client, 'get').mockRejectedValue(new Error('ECONNREFUSED'));
    vi.spyOn(loggerModule, 'error').mockImplementation(() => {});

    const { req, res, next } = makeContext({ key: 'key-redis-down' });
    idempotency(req, res, next);
    await new Promise(r => setTimeout(r, 10));

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._statusCode).not.toBe(400);
    expect(res._statusCode).not.toBe(409);
  });

  test('logs an error when Redis.get throws', async () => {
    vi.spyOn(redisModule.client, 'get').mockRejectedValue(new Error('timeout'));
    const errorSpy = vi.spyOn(loggerModule, 'error').mockImplementation(() => {});

    const { req, res, next } = makeContext({ key: 'key-redis-log' });
    idempotency(req, res, next);
    await new Promise(r => setTimeout(r, 10));

    expect(errorSpy).toHaveBeenCalledWith(
      '[idempotency] Redis error, failing open',
      expect.objectContaining({ error: 'timeout' }),
    );
  });
});
