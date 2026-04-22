'use strict';

jest.mock('stellar-sdk');
jest.mock('../cache/redisClient');

const { Horizon } = require('stellar-sdk');
const { getRedisClient } = require('../cache/redisClient');
const { HorizonService } = require('../services/horizonService');

// ── Fixtures ──────────────────────────────────────────────────────────────
const ACCOUNT_ID = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

const BALANCES = [
  { asset_type: 'native', balance: '10.0000000' },
  { asset_type: 'credit_alphanum4', asset_code: 'NOVA', asset_issuer: 'GISSUER', balance: '500.0000000' },
];

const TX_RECORDS = [{ id: 'tx1', hash: 'abc123' }];
const OP_RECORDS = [{ id: 'op1', type: 'payment' }];

// ── Helpers ───────────────────────────────────────────────────────────────
function makeRedis({ getVal = null } = {}) {
  return {
    get: jest.fn().mockResolvedValue(getVal ? JSON.stringify(getVal) : null),
    set: jest.fn().mockResolvedValue('OK'),
  };
}

function makeServer({ balances = BALANCES, txRecords = TX_RECORDS, opRecords = OP_RECORDS } = {}) {
  const callFn = (records) => jest.fn().mockResolvedValue({ records });
  const chainable = (records) => {
    const obj = {
      forAccount: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      cursor: jest.fn().mockReturnThis(),
      call: callFn(records),
    };
    return obj;
  };

  return {
    loadAccount: jest.fn().mockResolvedValue({ balances }),
    transactions: jest.fn(() => chainable(txRecords)),
    operations: jest.fn(() => chainable(opRecords)),
  };
}

function makeService(serverOverride) {
  const svc = new HorizonService('https://horizon-testnet.stellar.org');
  svc.server = serverOverride || makeServer();
  return svc;
}

// ── Tests ─────────────────────────────────────────────────────────────────
describe('HorizonService', () => {
  beforeEach(() => {
    getRedisClient.mockReturnValue(makeRedis());
    Horizon.Server.mockImplementation(() => makeServer());
  });

  // ── getAccountBalance ────────────────────────────────────────────────────
  describe('getAccountBalance', () => {
    it('returns balances from Horizon', async () => {
      const svc = makeService();
      const result = await svc.getAccountBalance(ACCOUNT_ID);
      expect(result).toEqual(BALANCES);
      expect(svc.server.loadAccount).toHaveBeenCalledWith(ACCOUNT_ID);
    });

    it('returns cached value without calling Horizon', async () => {
      getRedisClient.mockReturnValue(makeRedis({ getVal: BALANCES }));
      const svc = makeService();
      const result = await svc.getAccountBalance(ACCOUNT_ID);
      expect(result).toEqual(BALANCES);
      expect(svc.server.loadAccount).not.toHaveBeenCalled();
    });

    it('caches the Horizon response in Redis', async () => {
      const redis = makeRedis();
      getRedisClient.mockReturnValue(redis);
      const svc = makeService();
      await svc.getAccountBalance(ACCOUNT_ID);
      expect(redis.set).toHaveBeenCalledWith(
        `horizon:balance:${ACCOUNT_ID}`,
        JSON.stringify(BALANCES),
        'EX',
        expect.any(Number)
      );
    });

    it('still fetches from Horizon when Redis is unavailable', async () => {
      getRedisClient.mockReturnValue(null);
      const svc = makeService();
      const result = await svc.getAccountBalance(ACCOUNT_ID);
      expect(result).toEqual(BALANCES);
    });
  });

  // ── getTransactionHistory ────────────────────────────────────────────────
  describe('getTransactionHistory', () => {
    it('returns transaction records from Horizon', async () => {
      const svc = makeService();
      const result = await svc.getTransactionHistory(ACCOUNT_ID);
      expect(result).toEqual(TX_RECORDS);
    });

    it('returns cached transactions without calling Horizon', async () => {
      getRedisClient.mockReturnValue(makeRedis({ getVal: TX_RECORDS }));
      const svc = makeService();
      const result = await svc.getTransactionHistory(ACCOUNT_ID);
      expect(result).toEqual(TX_RECORDS);
      expect(svc.server.transactions).not.toHaveBeenCalled();
    });

    it('passes limit, cursor, and order to the builder', async () => {
      // Capture the builder instance on the first transactions() call
      const capturedBuilders = [];
      const server = makeServer();
      const origTx = server.transactions.bind(server);
      server.transactions = jest.fn(() => {
        const b = origTx();
        capturedBuilders.push(b);
        return b;
      });
      const svc = makeService(server);
      await svc.getTransactionHistory(ACCOUNT_ID, { limit: 5, cursor: 'cur1', order: 'asc' });
      const builder = capturedBuilders[0];
      expect(builder.limit).toHaveBeenCalledWith(5);
      expect(builder.order).toHaveBeenCalledWith('asc');
      expect(builder.cursor).toHaveBeenCalledWith('cur1');
    });
  });

  // ── getOperations ────────────────────────────────────────────────────────
  describe('getOperations', () => {
    it('returns operation records from Horizon', async () => {
      const svc = makeService();
      const result = await svc.getOperations(ACCOUNT_ID);
      expect(result).toEqual(OP_RECORDS);
    });

    it('returns cached operations without calling Horizon', async () => {
      getRedisClient.mockReturnValue(makeRedis({ getVal: OP_RECORDS }));
      const svc = makeService();
      const result = await svc.getOperations(ACCOUNT_ID);
      expect(result).toEqual(OP_RECORDS);
      expect(svc.server.operations).not.toHaveBeenCalled();
    });
  });

  // ── Retry logic ──────────────────────────────────────────────────────────
  describe('retry on 429', () => {
    it('retries on 429 and succeeds on the next attempt', async () => {
      jest.useFakeTimers();
      const err429 = Object.assign(new Error('Too Many Requests'), { response: { status: 429 } });
      const server = makeServer();
      server.loadAccount
        .mockRejectedValueOnce(err429)
        .mockResolvedValueOnce({ balances: BALANCES });

      const svc = makeService(server);
      const promise = svc.getAccountBalance(ACCOUNT_ID);
      await jest.advanceTimersByTimeAsync(600);
      const result = await promise;
      expect(result).toEqual(BALANCES);
      expect(server.loadAccount).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('throws after exhausting all retries', async () => {
      // Use real timers but replace setTimeout to resolve immediately
      const origSetTimeout = global.setTimeout;
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => origSetTimeout(fn, 0));

      const err429 = Object.assign(new Error('Too Many Requests'), { response: { status: 429 } });
      const server = makeServer();
      server.loadAccount.mockRejectedValue(err429);

      const svc = makeService(server);
      await expect(svc.getAccountBalance(ACCOUNT_ID)).rejects.toMatchObject({ response: { status: 429 } });
      expect(server.loadAccount).toHaveBeenCalledTimes(4); // initial + 3 retries

      jest.restoreAllMocks();
    });

    it('does not retry on non-429 errors', async () => {
      const err500 = Object.assign(new Error('Server Error'), { response: { status: 500 } });
      const server = makeServer();
      server.loadAccount.mockRejectedValue(err500);

      const svc = makeService(server);
      await expect(svc.getAccountBalance(ACCOUNT_ID)).rejects.toMatchObject({ response: { status: 500 } });
      expect(server.loadAccount).toHaveBeenCalledTimes(1);
    });
  });
});
