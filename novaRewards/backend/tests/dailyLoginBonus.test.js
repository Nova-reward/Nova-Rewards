// Feature: Daily Login Bonus cron job
// Validates: Requirements #189
// Verifies correct cohort selection, point crediting, and double-grant prevention.

jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const { runDailyLoginBonus } = require('../jobs/dailyLoginBonus');

beforeEach(() => {
  jest.clearAllMocks();
  process.env.DAILY_BONUS_POINTS = '10';
});

// Fixed "now" = 2026-03-27T06:00:00Z  →  yesterday window: 2026-03-26T00:00Z – 2026-03-27T00:00Z
const NOW = new Date('2026-03-27T06:00:00.000Z');
const YESTERDAY_START = new Date('2026-03-26T00:00:00.000Z');
const TODAY_START     = new Date('2026-03-27T00:00:00.000Z');

describe('runDailyLoginBonus — cohort selection', () => {
  test('queries users with last_login_at in the previous calendar day (UTC)', async () => {
    query.mockResolvedValue({ rows: [] }); // no users → nothing to credit

    await runDailyLoginBonus(NOW);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/last_login_at\s*>=\s*\$1/);
    expect(sql).toMatch(/last_login_at\s*<\s*\$2/);
    expect(params[0]).toEqual(YESTERDAY_START);
    expect(params[1]).toEqual(TODAY_START);
  });

  test('excludes users whose daily_bonus_granted_at is already today', async () => {
    query.mockResolvedValue({ rows: [] });

    await runDailyLoginBonus(NOW);

    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/daily_bonus_granted_at/);
  });
});

describe('runDailyLoginBonus — crediting', () => {
  test('inserts a bonus PointTransaction and updates dailyBonusGrantedAt for each qualifying user', async () => {
    // First call = SELECT users; subsequent calls = INSERT + UPDATE per user
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }) // cohort query
      .mockResolvedValue({ rows: [] });                          // INSERT + UPDATE calls

    const result = await runDailyLoginBonus(NOW);

    expect(result.credited).toBe(2);
    expect(result.failed).toBe(0);

    // Each user gets an INSERT into point_transactions
    const insertCalls = query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO point_transactions'));
    expect(insertCalls).toHaveLength(2);
    insertCalls.forEach(([sql, params]) => {
      expect(sql).toMatch(/type.*bonus|bonus.*type/i);
      expect(params[1]).toBe(10); // DAILY_BONUS_POINTS
    });

    // Each user gets an UPDATE to daily_bonus_granted_at
    const updateCalls = query.mock.calls.filter(([sql]) => sql.includes('UPDATE users SET daily_bonus_granted_at'));
    expect(updateCalls).toHaveLength(2);
  });

  test('counts failures without throwing when a single user credit fails', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 10 }, { id: 11 }] })
      .mockRejectedValueOnce(new Error('db error')) // user 10 INSERT fails
      .mockResolvedValue({ rows: [] });              // user 11 succeeds

    const result = await runDailyLoginBonus(NOW);

    expect(result.credited).toBe(1);
    expect(result.failed).toBe(1);
  });

  test('returns credited=0 when no users qualify', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const result = await runDailyLoginBonus(NOW);

    expect(result.credited).toBe(0);
    expect(result.failed).toBe(0);
    expect(query).toHaveBeenCalledTimes(1); // only the SELECT
  });

  test('uses DAILY_BONUS_POINTS from env', async () => {
    process.env.DAILY_BONUS_POINTS = '25';
    query
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValue({ rows: [] });

    await runDailyLoginBonus(NOW);

    const [, params] = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO point_transactions'));
    expect(params[1]).toBe(25);
  });
});
