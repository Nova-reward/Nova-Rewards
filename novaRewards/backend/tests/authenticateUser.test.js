// Unit tests for authenticateUser middleware
jest.mock('../db/index', () => ({ query: jest.fn() }));
jest.mock('../services/tokenService', () => ({
  verifyToken: jest.fn(),
  isRevoked: jest.fn().mockResolvedValue(false),
}));
jest.mock('../lib/logger', () => ({ error: jest.fn(), info: jest.fn() }));
jest.mock('../services/auditService', () => ({ log: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/securityAlertService', () => ({ send: jest.fn().mockResolvedValue(undefined) }));

const jwt = require('jsonwebtoken');
const { query } = require('../db/index');
const { verifyToken, isRevoked } = require('../services/tokenService');
const { authenticateUser, requireAdmin, requireOwnershipOrAdmin } = require('../middleware/authenticateUser');

function mockReqRes(headers = {}, params = {}, method = 'GET') {
  const req = { headers, params, method, user: null };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

beforeEach(() => jest.clearAllMocks());

describe('authenticateUser', () => {
  test('returns 401 with TOKEN_MISSING when no Authorization header', async () => {
    const { req, res, next } = mockReqRes();
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_MISSING' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 with TOKEN_MISSING when Authorization header lacks Bearer prefix', async () => {
    const { req, res, next } = mockReqRes({ authorization: 'Token abc123' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_MISSING' }));
  });

  test('returns 401 with TOKEN_EXPIRED when token is expired', async () => {
    verifyToken.mockImplementation(() => {
      throw new jwt.TokenExpiredError('jwt expired', new Date());
    });
    const { req, res, next } = mockReqRes({ authorization: 'Bearer expired.token.here' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_EXPIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 with TOKEN_INVALID when token is malformed', async () => {
    verifyToken.mockImplementation(() => { throw new Error('invalid signature'); });
    const { req, res, next } = mockReqRes({ authorization: 'Bearer bad.token.here' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_INVALID' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 with TOKEN_INVALID when decoded payload has no sub', async () => {
    verifyToken.mockReturnValue({ role: 'user' }); // missing sub
    const { req, res, next } = mockReqRes({ authorization: 'Bearer valid.token.here' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_INVALID' }));
  });

  test('returns 401 with TOKEN_INVALID when user not found in DB', async () => {
    verifyToken.mockReturnValue({ sub: 'WALLET_XYZ' });
    query.mockResolvedValue({ rows: [] });
    const { req, res, next } = mockReqRes({ authorization: 'Bearer valid.token.here' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_INVALID' }));
  });

  test('returns 401 with TOKEN_INVALID when token jti is revoked', async () => {
    verifyToken.mockReturnValue({ sub: 'WALLET_XYZ', jti: 'some-jti' });
    isRevoked.mockResolvedValue(true);
    const { req, res, next } = mockReqRes({ authorization: 'Bearer revoked.token.here' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_INVALID' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches user with userId, role, walletAddress and calls next on success', async () => {
    const dbUser = { id: 1, role: 'user', wallet_address: 'WALLET_ABC', email: 'a@b.com' };
    verifyToken.mockReturnValue({ sub: 'WALLET_ABC' });
    query.mockResolvedValue({ rows: [dbUser] });
    const { req, res, next } = mockReqRes({ authorization: 'Bearer valid.token.here' });
    await authenticateUser(req, res, next);
    expect(req.user).toMatchObject({
      id: 1,
      role: 'user',
      wallet_address: 'WALLET_ABC',
      userId: 1,
      walletAddress: 'WALLET_ABC',
    });
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  test('returns 403 for non-admin', async () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'user', id: 1 };
    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next for admin', async () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'admin', id: 1 };
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireOwnershipOrAdmin', () => {
  test('allows GET requests through', () => {
    const { req, res, next } = mockReqRes({}, { id: '2' }, 'GET');
    req.user = { id: 1, role: 'user' };
    requireOwnershipOrAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows owner on non-GET', () => {
    const { req, res, next } = mockReqRes({}, { id: '1' }, 'PATCH');
    req.user = { id: 1, role: 'user' };
    requireOwnershipOrAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows admin on non-GET', () => {
    const { req, res, next } = mockReqRes({}, { id: '2' }, 'DELETE');
    req.user = { id: 1, role: 'admin' };
    requireOwnershipOrAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 403 for non-owner non-admin on non-GET', () => {
    const { req, res, next } = mockReqRes({}, { id: '2' }, 'PATCH');
    req.user = { id: 1, role: 'user' };
    requireOwnershipOrAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
