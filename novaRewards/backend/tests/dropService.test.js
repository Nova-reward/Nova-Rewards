jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const { evaluateCriteria } = require('../services/dropService');

const DAY_MS = 1000 * 60 * 60 * 24;

describe('evaluateCriteria', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('user with points below minPoints returns eligible:false with reason', async () => {
    query.mockResolvedValue({ rows: [{ total: '50' }] });
    const user = { id: 1, created_at: new Date().toISOString() };

    const result = await evaluateCriteria(user, { minPoints: 100 });

    expect(result).toEqual({
      eligible: false,
      reason: 'Minimum 100 points required; you have 50',
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('user with account age below minAccountAgeDays returns eligible:false', async () => {
    const user = { id: 1, created_at: new Date(Date.now() - 5 * DAY_MS).toISOString() };

    const result = await evaluateCriteria(user, { minAccountAgeDays: 30 });

    expect(result).toEqual({
      eligible: false,
      reason: 'Account must be at least 30 days old',
    });
    expect(query).not.toHaveBeenCalled();
  });

  test('user with referrals below minReferrals returns eligible:false', async () => {
    query.mockResolvedValue({ rows: [{ cnt: '2' }] });
    const user = { id: 1, created_at: new Date().toISOString() };

    const result = await evaluateCriteria(user, { minReferrals: 5 });

    expect(result).toEqual({
      eligible: false,
      reason: 'Minimum 5 referrals required; you have 2',
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('user meeting all criteria returns eligible:true', async () => {
    const user = { id: 1, created_at: new Date(Date.now() - 365 * DAY_MS).toISOString() };
    query
      .mockResolvedValueOnce({ rows: [{ total: '500' }] })
      .mockResolvedValueOnce({ rows: [{ cnt: '10' }] });

    const result = await evaluateCriteria(user, {
      minPoints: 100,
      minAccountAgeDays: 30,
      minReferrals: 5,
    });

    expect(result).toEqual({ eligible: true });
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('empty criteria {} returns eligible:true without querying the database', async () => {
    const user = { id: 1, created_at: new Date().toISOString() };

    const result = await evaluateCriteria(user, {});

    expect(result).toEqual({ eligible: true });
    expect(query).not.toHaveBeenCalled();
  });

  test('undefined criteria are ignored while defined ones are still evaluated', async () => {
    const user = { id: 1, created_at: new Date(Date.now() - 365 * DAY_MS).toISOString() };
    query.mockResolvedValueOnce({ rows: [{ total: '500' }] });

    const result = await evaluateCriteria(user, {
      minPoints: 100,
      minReferrals: undefined,
    });

    expect(result).toEqual({ eligible: true });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
