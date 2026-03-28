// Unit tests for authenticateUser middleware
jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
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

// Build a valid JWT-like token with base64-encoded payload
function makeToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `header.${encoded}.sig`;
}

beforeEach(() => jest.clearAllMocks());

describe('authenticateUser', () => {
  test('returns 401 when no Authorization header', async () => {
    const { req, res, next } = mockReqRes();
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token is malformed', async () => {
    const { req, res, next } = mockReqRes({ authorization: 'Bearer bad.token' });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('returns 401 when user not found in DB', async () => {
    const token = makeToken({ userId: 999 });
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    query.mockResolvedValue({ rows: [] });
    await authenticateUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('attaches user to req and calls next on success', async () => {
    const user = { id: 1, role: 'user' };
    const token = makeToken({ userId: 1 });
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
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
