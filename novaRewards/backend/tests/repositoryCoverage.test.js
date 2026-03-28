// Coverage tests for adminRepository, contractEventRepository, emailLogRepository, leaderboardRepository
jest.mock('../db/index', () => ({ query: jest.fn() }));
jest.mock('../lib/redis', () => ({
  client: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));

const { query } = require('../db/index');
const { client: redis } = require('../lib/redis');

beforeEach(() => jest.clearAllMocks());

// ── adminRepository ──────────────────────────────────────────────────────────
describe('adminRepository', () => {
  const repo = require('../db/adminRepository');

  test('getStats returns platform stats', async () => {
    query.mockResolvedValue({ rows: [{ total_users: '10', total_points_issued: '500', total_redemptions: '100', active_rewards: '5' }] });
    const stats = await repo.getStats();
    expect(stats.total_users).toBe('10');
  });

  test('listUsers returns paginated users', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 1, wallet_address: 'GABC' }] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });
    const result = await repo.listUsers({ search: '', page: 1, limit: 10 });
    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  test('createReward inserts and returns reward', async () => {
    const reward = { id: 1, name: 'Coffee', cost: '5.00', stock: 10 };
    query.mockResolvedValue({ rows: [reward] });
    const result = await repo.createReward({ name: 'Coffee', cost: 5, stock: 10 });
    expect(result).toEqual(reward);
  });

  test('updateReward updates allowed fields', async () => {
    const reward = { id: 1, name: 'Tea', cost: '3.00' };
    query.mockResolvedValue({ rows: [reward] });
    const result = await repo.updateReward(1, { name: 'Tea', cost: 3 });
    expect(result).toEqual(reward);
  });

  test('updateReward with no fields returns existing reward', async () => {
    const reward = { id: 1, name: 'Coffee' };
    query.mockResolvedValue({ rows: [reward] });
    const result = await repo.updateReward(1, {});
    expect(result).toEqual(reward);
  });

  test('deleteReward soft-deletes and returns true', async () => {
    query.mockResolvedValue({ rowCount: 1 });
    expect(await repo.deleteReward(1)).toBe(true);
  });

  test('deleteReward returns false when not found', async () => {
    query.mockResolvedValue({ rowCount: 0 });
    expect(await repo.deleteReward(999)).toBe(false);
  });
});

// ── contractEventRepository ──────────────────────────────────────────────────
describe('contractEventRepository', () => {
  const repo = require('../db/contractEventRepository');

  test('recordContractEvent inserts and returns event', async () => {
    const event = { id: 1, contract_id: 'C1', event_type: 'mint' };
    query.mockResolvedValue({ rows: [event] });
    const result = await repo.recordContractEvent({
      contractId: 'C1', eventType: 'mint', eventData: { amount: 100 },
    });
    expect(result).toEqual(event);
  });

  test('markEventProcessed updates status', async () => {
    const event = { id: 1, status: 'processed' };
    query.mockResolvedValue({ rows: [event] });
    expect(await repo.markEventProcessed(1)).toEqual(event);
  });

  test('markEventFailed updates status and increments retry', async () => {
    const event = { id: 1, status: 'failed', retry_count: 1 };
    query.mockResolvedValue({ rows: [event] });
    expect(await repo.markEventFailed(1, 'error msg')).toEqual(event);
  });

  test('getPendingEvents returns pending events', async () => {
    const events = [{ id: 1, status: 'pending' }];
    query.mockResolvedValue({ rows: events });
    expect(await repo.getPendingEvents(5)).toEqual(events);
  });

  test('getContractEvents returns paginated events', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    const result = await repo.getContractEvents({ page: 1, limit: 20 });
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
  });

  test('getContractEvents with filters', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const result = await repo.getContractEvents({ contractId: 'C1', eventType: 'mint', page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
  });

  test('getContractEventById returns event', async () => {
    const event = { id: 1 };
    query.mockResolvedValue({ rows: [event] });
    expect(await repo.getContractEventById(1)).toEqual(event);
  });

  test('getContractEventById returns null when not found', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.getContractEventById(999)).toBeNull();
  });
});

// ── emailLogRepository ───────────────────────────────────────────────────────
describe('emailLogRepository', () => {
  const repo = require('../db/emailLogRepository');

  test('createEmailLog inserts and returns log', async () => {
    const log = { id: 1, recipient_email: 'a@b.com', status: 'queued' };
    query.mockResolvedValue({ rows: [log] });
    const result = await repo.createEmailLog({
      recipientEmail: 'a@b.com', emailType: 'welcome', subject: 'Hi',
    });
    expect(result).toEqual(log);
  });

  test('markEmailSent updates status', async () => {
    const log = { id: 1, status: 'sent' };
    query.mockResolvedValue({ rows: [log] });
    expect(await repo.markEmailSent(1)).toEqual(log);
  });

  test('markEmailDelivered updates status', async () => {
    const log = { id: 1, status: 'delivered' };
    query.mockResolvedValue({ rows: [log] });
    expect(await repo.markEmailDelivered(1)).toEqual(log);
  });

  test('markEmailFailed updates status', async () => {
    const log = { id: 1, status: 'failed' };
    query.mockResolvedValue({ rows: [log] });
    expect(await repo.markEmailFailed(1, 'SMTP error')).toEqual(log);
  });

  test('getEmailLogs returns paginated logs', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '3' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    const result = await repo.getEmailLogs({ page: 1, limit: 20 });
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(3);
  });

  test('getEmailLogs with filters', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const result = await repo.getEmailLogs({
      recipientEmail: 'a@b.com', emailType: 'welcome', status: 'sent', page: 1, limit: 10,
    });
    expect(result.data).toHaveLength(1);
  });

  test('getEmailLogById returns log', async () => {
    const log = { id: 1 };
    query.mockResolvedValue({ rows: [log] });
    expect(await repo.getEmailLogById(1)).toEqual(log);
  });

  test('getEmailLogById returns null when not found', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.getEmailLogById(999)).toBeNull();
  });
});

// ── leaderboardRepository ────────────────────────────────────────────────────
describe('leaderboardRepository', () => {
  const repo = require('../db/leaderboardRepository');

  test('getLeaderboard returns rankings for alltime', async () => {
    const rankings = [{ user_id: 1, total_points: '500', rank: '1' }];
    query.mockResolvedValue({ rows: rankings });
    const result = await repo.getLeaderboard('alltime', 10, null);
    expect(result.rankings).toEqual(rankings);
    expect(result.currentUser).toBeNull();
  });

  test('getLeaderboard returns rankings for weekly', async () => {
    const rankings = [{ user_id: 1, total_points: '100', rank: '1' }];
    query.mockResolvedValue({ rows: rankings });
    const result = await repo.getLeaderboard('weekly', 10, 1);
    expect(result.rankings).toEqual(rankings);
    // user is in top rankings, so currentUser is null
    expect(result.currentUser).toBeNull();
  });

  test('getLeaderboard fetches currentUser when not in top', async () => {
    const rankings = [{ user_id: 2, total_points: '500', rank: '1' }];
    const currentUserRow = { user_id: 1, total_points: '50', rank: '5' };
    query
      .mockResolvedValueOnce({ rows: rankings })
      .mockResolvedValueOnce({ rows: [currentUserRow] });
    const result = await repo.getLeaderboard('alltime', 10, 1);
    expect(result.currentUser).toEqual(currentUserRow);
  });
});
