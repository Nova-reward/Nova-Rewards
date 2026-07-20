'use strict';
/**
 * Tests for middleware/errorHandler.js
 * Covers: AppError, globalErrorHandler, notFoundHandler, isDownstreamError, sendError
 * Closes #856
 */

const {
  AppError,
  globalErrorHandler,
  notFoundHandler,
  sendError,
  isDownstreamError,
} = require('../middleware/errorHandler');

// Minimal Express-like res/req/next stubs
function makeRes() {
  const res = { _status: null, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  res.headersSent = false;
  return res;
}
function makeReq(method = 'GET', path = '/api/unknown') {
  return { method, path };
}
const noop = () => {};

// ── AppError ──────────────────────────────────────────────────────────────
describe('AppError', () => {
  test('sets message, code, statusCode', () => {
    const err = new AppError('Not found', 'not_found', 404);
    expect(err.message).toBe('Not found');
    expect(err.code).toBe('not_found');
    expect(err.statusCode).toBe(404);
    expect(err instanceof Error).toBe(true);
  });

  test('defaults statusCode to 500', () => {
    const err = new AppError('oops', 'internal_error');
    expect(err.statusCode).toBe(500);
  });
});

// ── isDownstreamError ─────────────────────────────────────────────────────
describe('isDownstreamError', () => {
  test.each([
    ['ECONNREFUSED', {}],
    ['ETIMEDOUT', {}],
    ['connection refused', {}],
    ['Redis connection lost', {}],
    ['Horizon RPC error', {}],
    ['socket hang up', {}],
  ])('detects downstream error: %s', (msg) => {
    expect(isDownstreamError(new Error(msg))).toBe(true);
  });

  test('returns false for unrelated errors', () => {
    expect(isDownstreamError(new Error('some random application error'))).toBe(false);
  });
});

// ── sendError ─────────────────────────────────────────────────────────────
describe('sendError', () => {
  test('sends { error, code, statusCode } envelope', () => {
    const res = makeRes();
    sendError(res, 422, 'validation_error', 'Bad input');
    expect(res._status).toBe(422);
    expect(res._body).toEqual({ error: 'Bad input', code: 'validation_error', statusCode: 422 });
  });
});

// ── notFoundHandler ───────────────────────────────────────────────────────
describe('notFoundHandler', () => {
  test('returns 404 with not_found code', () => {
    const req = makeReq('POST', '/api/nope');
    const res = makeRes();
    notFoundHandler(req, res);
    expect(res._status).toBe(404);
    expect(res._body.code).toBe('not_found');
    expect(res._body.statusCode).toBe(404);
    expect(res._body.error).toContain('/api/nope');
  });
});

// ── globalErrorHandler ────────────────────────────────────────────────────
describe('globalErrorHandler', () => {
  const req = makeReq();

  test('handles AppError → correct status and code', () => {
    const res = makeRes();
    const err = new AppError('Campaign not found', 'not_found', 404);
    globalErrorHandler(err, req, res, noop);
    expect(res._status).toBe(404);
    expect(res._body).toEqual({ error: 'Campaign not found', code: 'not_found', statusCode: 404 });
  });

  test('handles JSON parse error → 400 invalid_json', () => {
    const res = makeRes();
    const err = Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed' });
    globalErrorHandler(err, req, res, noop);
    expect(res._status).toBe(400);
    expect(res._body.code).toBe('invalid_json');
  });

  test('handles downstream error → 503 service_unavailable', () => {
    const res = makeRes();
    globalErrorHandler(new Error('ECONNREFUSED to postgres'), req, res, noop);
    expect(res._status).toBe(503);
    expect(res._body.code).toBe('service_unavailable');
  });

  test('handles unknown error → 500 internal_error', () => {
    const res = makeRes();
    globalErrorHandler(new Error('Something exploded'), req, res, noop);
    expect(res._status).toBe(500);
    expect(res._body.code).toBe('internal_error');
  });

  test('calls next() when headers already sent', () => {
    const res = makeRes();
    res.headersSent = true;
    const next = jest.fn();
    const err = new Error('late error');
    globalErrorHandler(err, req, res, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res._status).toBeNull(); // no response written
  });
});
