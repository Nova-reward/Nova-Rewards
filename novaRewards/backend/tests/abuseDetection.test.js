'use strict';

// ── Mock Redis client ─────────────────────────────────────────────────────────
jest.mock('../lib/redis', () => ({
  client: {
    get:    jest.fn(),
    set:    jest.fn(),
    del:    jest.fn(),
    incr:   jest.fn(),
    expire: jest.fn(),
    ttl:    jest.fn(),
    sAdd:   jest.fn(),
    sCard:  jest.fn(),
  },
}));

// ── Mock security alert service ───────────────────────────────────────────────
jest.mock('../services/securityAlertService', () => ({ sendSecurityAlert: jest.fn() }));

// ── Mock configService (required by securityAlertService) ────────────────────
jest.mock('../services/configService', () => ({
  getConfig: jest.fn((key, def) => def),
  getRequiredConfig: jest.fn(() => 'test'),
}));

// ── Mock emailService (required by securityAlertService) ─────────────────────
jest.mock('../services/emailService', () => ({ sendEmail: jest.fn() }));

const { client: redis } = require('../lib/redis');
const { sendSecurityAlert } = require('../services/securityAlertService');

const {
  checkIpBlock,
  recordFailedLogin,
  checkRewardFarming,
  recordRewardClaim,
  unblock,
  BLOCK_PREFIX,
  CRED_PREFIX,
  FARM_PREFIX,
} = require('../middleware/abuseDetection');

// ── Helpers ───────────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return { ip: '1.2.3.4', body: {}, connection: { remoteAddress: '1.2.3.4' }, ...overrides };
}
function mockRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: not blocked, incr returns 1, ttl returns 10, sCard returns 1
  redis.get.mockResolvedValue(null);
  redis.set.mockResolvedValue('OK');
  redis.del.mockResolvedValue(1);
  redis.incr.mockResolvedValue(1);
  redis.expire.mockResolvedValue(1);
  redis.ttl.mockResolvedValue(30);
  redis.sAdd.mockResolvedValue(1);
  redis.sCard.mockResolvedValue(1);
});

// ── checkIpBlock ──────────────────────────────────────────────────────────────
describe('checkIpBlock', () => {
  test('calls next() when IP is not blocked', async () => {
    redis.get.mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await checkIpBlock(req, res, next);

    expect(redis.get).toHaveBeenCalledWith(`${BLOCK_PREFIX}1.2.3.4`);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 429 when IP is blocked', async () => {
    redis.get.mockResolvedValue('1');
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await checkIpBlock(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'ip_blocked' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() when Redis throws (fail open)', async () => {
    redis.get.mockRejectedValue(new Error('Redis down'));
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await checkIpBlock(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ── recordFailedLogin ─────────────────────────────────────────────────────────
describe('recordFailedLogin', () => {
  test('increments the failed login counter for the IP', async () => {
    redis.incr.mockResolvedValue(1);
    await recordFailedLogin(mockReq());
    expect(redis.incr).toHaveBeenCalledWith(`${CRED_PREFIX}1.2.3.4`);
  });

  test('sets TTL on first increment', async () => {
    redis.incr.mockResolvedValue(1);
    await recordFailedLogin(mockReq());
    expect(redis.expire).toHaveBeenCalledTimes(1);
  });

  test('does not set TTL on subsequent increments', async () => {
    redis.incr.mockResolvedValue(5);
    await recordFailedLogin(mockReq());
    expect(redis.expire).not.toHaveBeenCalled();
  });

  test('blocks IP and sends alert when threshold is reached', async () => {
    redis.incr.mockResolvedValue(10); // exactly at threshold
    await recordFailedLogin(mockReq());

    expect(redis.set).toHaveBeenCalledWith(
      `${BLOCK_PREFIX}1.2.3.4`,
      '1',
      expect.objectContaining({ EX: expect.any(Number) }),
    );
    expect(sendSecurityAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CREDENTIAL_STUFFING', identifier: '1.2.3.4' }),
    );
  });

  test('does not block IP below threshold', async () => {
    redis.incr.mockResolvedValue(9);
    await recordFailedLogin(mockReq());
    expect(redis.set).not.toHaveBeenCalled();
    expect(sendSecurityAlert).not.toHaveBeenCalled();
  });
});

// ── checkRewardFarming ────────────────────────────────────────────────────────
describe('checkRewardFarming', () => {
  test('calls next() when wallet is not blocked', async () => {
    redis.get.mockResolvedValue(null);
    const req = mockReq({ body: { wallet: 'GABC123' } });
    const res = mockRes();
    const next = jest.fn();

    await checkRewardFarming(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns 429 when wallet is blocked', async () => {
    redis.get.mockResolvedValue('1');
    const req = mockReq({ body: { wallet: 'GABC123' } });
    const res = mockRes();
    const next = jest.fn();

    await checkRewardFarming(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'wallet_blocked' }));
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() when no wallet in body', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = jest.fn();

    await checkRewardFarming(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(redis.get).not.toHaveBeenCalled();
  });
});

// ── recordRewardClaim ─────────────────────────────────────────────────────────
describe('recordRewardClaim', () => {
  test('adds campaignId to the wallet set', async () => {
    await recordRewardClaim('GABC123', 42);
    expect(redis.sAdd).toHaveBeenCalledWith(`${FARM_PREFIX}GABC123`, '42');
  });

  test('sets TTL when key is new (ttl === -1)', async () => {
    redis.ttl.mockResolvedValue(-1);
    await recordRewardClaim('GABC123', 1);
    expect(redis.expire).toHaveBeenCalledTimes(1);
  });

  test('blocks wallet and sends alert when farming threshold exceeded', async () => {
    redis.sCard.mockResolvedValue(6); // > 5 threshold
    await recordRewardClaim('GABC123', 6);

    expect(redis.set).toHaveBeenCalledWith(
      `${BLOCK_PREFIX}GABC123`,
      '1',
      expect.objectContaining({ EX: expect.any(Number) }),
    );
    expect(sendSecurityAlert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REWARD_FARMING', identifier: 'GABC123' }),
    );
  });

  test('does not block wallet below farming threshold', async () => {
    redis.sCard.mockResolvedValue(5); // exactly at threshold, not over
    await recordRewardClaim('GABC123', 5);
    expect(redis.set).not.toHaveBeenCalled();
    expect(sendSecurityAlert).not.toHaveBeenCalled();
  });

  test('does nothing when wallet is falsy', async () => {
    await recordRewardClaim(null, 1);
    expect(redis.sAdd).not.toHaveBeenCalled();
  });
});

// ── unblock ───────────────────────────────────────────────────────────────────
describe('unblock', () => {
  test('deletes the block key for the given identifier', async () => {
    await unblock('1.2.3.4');
    expect(redis.del).toHaveBeenCalledWith(`${BLOCK_PREFIX}1.2.3.4`);
  });

  test('works for wallet identifiers', async () => {
    await unblock('GABC123');
    expect(redis.del).toHaveBeenCalledWith(`${BLOCK_PREFIX}GABC123`);
  });
});
