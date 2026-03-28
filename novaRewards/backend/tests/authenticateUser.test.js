// Unit tests for authenticateUser middleware
jest.mock('../db/index', () => ({ query: jest.fn() }));
jest.mock('../services/tokenService', () => ({
  verifyToken: jest.fn(),
}));

const { query } = require('../db/index');
const { verifyToken } = require('../services/tokenService');
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
  test('returns 401 when no Authorization header', async () => {
    const { req, res, next } = mockReqRes();
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token verification throws (malformed token)', async () => {
    verifyToken.mockImplementation(() => { throw new Error('invalid token'); });
    const { req, res, next } = mockReqRes({ authorization: 'Bearer bad.token.here' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 when user not found in DB', async () => {
    verifyToken.mockReturnValue({ userId: 999 });
    const { req, res, next } = mockReqRes({ authorization: 'Bearer valid.token.here' });
    query.mockResolvedValue({ rows: [] });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('attaches user to req and calls next on success', async () => {
    const user = { id: 1, role: 'user' };
    verifyToken.mockReturnValue({ userId: 1 });
    const { req, res, next } = mockReqRes({ authorization: 'Bearer valid.token.here' });
    query.mockResolvedValue({ rows: [user] });
    await authenticateUser(req, res, next);
    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  test('returns 403 for non-admin', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'user' };
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next for admin', () => {
    const { req, res, next } = mockReqRes();
    req.user = { role: 'admin' };
    requireAdmin(req, res, next);
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
