jest.mock('../services/transactionService', () => ({
  recordTransaction: jest.fn(),
  getWalletHistory: jest.fn(),
  getUserHistory: jest.fn(),
  getMerchantHistory: jest.fn(),
  refundTransaction: jest.fn(),
  reconcileMerchantTransactions: jest.fn(),
  getMerchantTransactionReport: jest.fn(),
}));

const router = require('../routes/transactions');
const { getUserHistory } = require('../services/transactionService');

function getRouteHandlers(method, path) {
  const layer = router.stack.find(
    (candidate) => candidate.route && candidate.route.path === path && candidate.route.methods[method]
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  return layer.route.stack.map((entry) => entry.handle);
}

async function invokeRoute(method, path, { body = {}, query = {}, params = {} } = {}) {
  const handlers = getRouteHandlers(method, path);
  const req = { body, query, params, headers: {} };
  let statusCode = 200;
  let payload;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };

  for (const handler of handlers) {
    let nextCalled = false;
    let nextError;

    await Promise.resolve(handler(req, res, (err) => {
      nextCalled = true;
      nextError = err;
    }));

    if (nextError) {
      throw nextError;
    }

    if (!nextCalled) {
      break;
    }
  }

  return { status: statusCode, body: payload };
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/transactions/user/history', () => {
  test('returns paginated transaction history', async () => {
    getUserHistory.mockResolvedValue({
      data: [
        { id: 1, tx_type: 'distribution', amount: '100', status: 'completed' },
        { id: 2, tx_type: 'redemption', amount: '50', status: 'reconciled' },
      ],
      total: 2,
      page: 1,
      limit: 20,
    });

    const result = await invokeRoute('get', '/user/history', {
      query: { userId: '1', status: 'completed' },
    });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.data).toHaveLength(2);
    expect(result.body.total).toBe(2);
    expect(getUserHistory).toHaveBeenCalledWith({ userId: '1', status: 'completed' });
  });

  test('propagates validation errors from the service layer', async () => {
    const err = new Error('userId query parameter is required');
    err.status = 400;
    err.code = 'validation_error';
    getUserHistory.mockRejectedValue(err);

    await expect(invokeRoute('get', '/user/history')).rejects.toMatchObject({
      status: 400,
      code: 'validation_error',
    });
  });

  test('propagates not found errors from the service layer', async () => {
    const err = new Error('User not found');
    err.status = 404;
    err.code = 'not_found';
    getUserHistory.mockRejectedValue(err);

    await expect(invokeRoute('get', '/user/history', {
      query: { userId: '999' },
    })).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
    });
  });
});
