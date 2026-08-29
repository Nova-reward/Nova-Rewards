/**
 * Tests — Mock API (mockApi.ts) + API Modules (apiModules.ts)
 *
 * @jest-environment node
 *
 * Strategy: Use axios-mock-adapter to intercept the default apiClient singleton
 * at the Axios adapter level (no network), then verify that each API module
 * calls the right URL, sends the right body, and maps the response correctly.
 *
 * The mockApi.ts module is tested separately for its handler shape.
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import apiClient from '../lib/apiClient';
import {
  authApi,
  usersApi,
  campaignsApi,
  rewardsApi,
  transactionsApi,
  merchantApi,
  adminApi,
} from '../lib/apiModules';

// Mock offlineStorage / pwa so apiClient interceptors don't crash in Node
jest.mock('../lib/offlineStorage', () => ({
  saveToOfflineCache: jest.fn().mockResolvedValue(undefined),
  getFromOfflineCache: jest.fn().mockResolvedValue(null),
}));
jest.mock('../lib/pwa', () => ({
  syncInBackground: jest.fn().mockResolvedValue(undefined),
}));

// Provide minimal localStorage shim for Node
const store: Record<string, string> = {};
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  },
  writable: true,
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mock: MockAdapter;

beforeAll(() => {
  mock = new MockAdapter(apiClient, { delayResponse: 0 });
});

afterEach(() => {
  mock.reset();
  Object.keys(store).forEach((k) => delete store[k]);
});

afterAll(() => {
  mock.restore();
});

// ---------------------------------------------------------------------------
// Helpers — standard response envelopes
// ---------------------------------------------------------------------------

function ok<T>(data: T) {
  return { success: true, data };
}

function paginated<T>(items: T[], total = items.length) {
  return { success: true, data: items, total, page: 1, limit: 10, hasMore: false };
}

// ---------------------------------------------------------------------------
// authApi
// ---------------------------------------------------------------------------

describe('authApi', () => {
  const mockUser = {
    id: 1,
    wallet_address: 'GABC...TEST',
    email: 'alice@nova.test',
    first_name: 'Alice',
    last_name: 'Stellar',
    role: 'user',
    created_at: '2026-01-01T00:00:00.000Z',
  };

  const mockTokens = {
    token: 'mock-token-123',
    refresh_token: 'mock-refresh-123',
    expires_in: 3600,
  };

  describe('login', () => {
    it('calls POST /auth/login and returns user + tokens', async () => {
      mock.onPost('/auth/login').reply(200, ok({ user: mockUser, tokens: mockTokens }));
      const result = await authApi.login({ email: 'alice@nova.test', password: 'pass' });
      expect(result.user.email).toBe('alice@nova.test');
      // camelCase conversion
      expect(result.user.walletAddress).toBe('GABC...TEST');
      expect(result.tokens.token).toBe('mock-token-123');
      expect(mock.history.post[0].url).toBe('/auth/login');
    });

    it('throws ApiError on invalid credentials', async () => {
      // Login with wrong password — any error is acceptable;
      // in a real browser the 401 triggers a refresh attempt.
      mock.onPost('/auth/login').reply(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
      // Mock the refresh call that will be triggered internally
      mock.onPost('/auth/refresh').reply(401, { code: 'INVALID_REFRESH', message: 'Bad' });
      await expect(
        authApi.login({ email: 'x@y.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe('register', () => {
    it('calls POST /auth/register and returns user + tokens', async () => {
      mock.onPost('/auth/register').reply(201, ok({ user: mockUser, tokens: mockTokens }));
      const result = await authApi.register({ email: 'new@nova.test', password: 'pass' });
      expect(result.user.email).toBe('alice@nova.test');
    });

    it('throws 409 on duplicate email', async () => {
      mock.onPost('/auth/register').reply(409, { code: 'EMAIL_EXISTS', message: 'Exists' });
      await expect(
        authApi.register({ email: 'dup@nova.test', password: 'pass' }),
      ).rejects.toMatchObject({ status: 409, code: 'EMAIL_EXISTS' });
    });
  });

  describe('refresh', () => {
    it('calls POST /auth/refresh', async () => {
      mock.onPost('/auth/refresh').reply(200, ok({ token: 'new-token', refresh_token: 'r', expires_in: 3600 }));
      const result = await authApi.refresh('refresh-xyz');
      expect(result.token).toBe('new-token');
    });

    it('throws on invalid refresh token', async () => {
      mock.onPost('/auth/refresh').reply(401, { code: 'INVALID_TOKEN', message: 'Bad' });
      await expect(authApi.refresh('bad')).rejects.toBeInstanceOf(Error);
    });
  });

  describe('logout', () => {
    it('calls POST /auth/logout and resolves', async () => {
      mock.onPost('/auth/logout').reply(200, ok({ message: 'OK' }));
      await expect(authApi.logout()).resolves.toBeUndefined();
    });
  });

  describe('requestPasswordReset', () => {
    it('resolves without error', async () => {
      mock.onPost('/auth/password-reset/request').reply(200, ok({ message: 'Sent' }));
      await expect(authApi.requestPasswordReset('alice@nova.test')).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('resolves without error', async () => {
      mock.onPost('/auth/password-reset/confirm').reply(200, ok({ message: 'Done' }));
      await expect(authApi.resetPassword('token', 'newpass')).resolves.toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// usersApi
// ---------------------------------------------------------------------------

describe('usersApi', () => {
  const mockUser = {
    id: 1,
    wallet_address: 'GABC',
    email: 'alice@nova.test',
    first_name: 'Alice',
    last_name: 'Stellar',
    role: 'user',
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('getMe — calls GET /users/me and camelizes keys', async () => {
    mock.onGet('/users/me').reply(200, ok(mockUser));
    const user = await usersApi.getMe();
    expect(user.email).toBe('alice@nova.test');
    expect(user.walletAddress).toBe('GABC');
  });

  it('getById — calls GET /users/:id', async () => {
    mock.onGet('/users/2').reply(200, ok({ ...mockUser, id: 2 }));
    const user = await usersApi.getById(2);
    expect(user.id).toBe(2);
  });

  it('getById — throws 404 for unknown id', async () => {
    mock.onGet('/users/99999').reply(404, { code: 'NOT_FOUND', message: 'Not found' });
    await expect(usersApi.getById(99999)).rejects.toMatchObject({ status: 404 });
  });

  it('updateProfile — calls PATCH /users/profile', async () => {
    mock.onPatch('/users/profile').reply(200, ok({ ...mockUser, first_name: 'Updated' }));
    const updated = await usersApi.updateProfile({ firstName: 'Updated' });
    expect(updated.firstName).toBe('Updated');
  });

  it('getBalance — calls GET /users/:id/balance', async () => {
    mock.onGet('/users/1/balance').reply(200, ok({
      wallet_address: 'GABC',
      nova_balance: '1250.5',
      points_balance: 2400,
      last_updated_at: new Date().toISOString(),
    }));
    const balance = await usersApi.getBalance(1);
    expect(balance.novaBalance).toBe('1250.5');
    expect(balance.pointsBalance).toBe(2400);
  });

  it('getLeaderboard — calls GET /users/leaderboard', async () => {
    mock.onGet('/users/leaderboard').reply(200, paginated([mockUser]));
    const result = await usersApi.getLeaderboard({ page: 1, limit: 5 });
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// campaignsApi
// ---------------------------------------------------------------------------

describe('campaignsApi', () => {
  const mockCampaign = {
    id: 1,
    merchant_id: 2,
    name: 'Coffee Rewards',
    reward_rate: 2.0,
    start_date: '2026-06-01',
    end_date: '2026-09-01',
    on_chain_status: 'confirmed',
    created_at: '2026-05-01T00:00:00.000Z',
  };

  it('list — calls GET /api/campaigns/public', async () => {
    mock.onGet('/api/campaigns/public').reply(200, paginated([mockCampaign]));
    const result = await campaignsApi.list({ page: 1, limit: 10 });
    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe('Coffee Rewards');
    expect(result.items[0].rewardRate).toBe(2.0);
    expect(result.items[0].onChainStatus).toBe('confirmed');
  });

  it('getById — calls GET /api/campaigns/public/:id', async () => {
    mock.onGet('/api/campaigns/public/1').reply(200, ok(mockCampaign));
    const campaign = await campaignsApi.getById(1);
    expect(campaign.id).toBe(1);
    expect(campaign.merchantId).toBe(2);
  });

  it('getById — throws 404', async () => {
    mock.onGet('/api/campaigns/public/99999').reply(404, { code: 'NOT_FOUND', message: 'Not found' });
    await expect(campaignsApi.getById(99999)).rejects.toMatchObject({ status: 404 });
  });

  it('create — calls POST /api/campaigns and returns new campaign', async () => {
    mock.onPost('/api/campaigns').reply(201, ok({ ...mockCampaign, id: 99 }));
    const result = await campaignsApi.create({
      name: 'New Campaign',
      rewardRate: 1.5,
      startDate: '2026-09-01',
      endDate: '2026-12-01',
    });
    expect(result.id).toBe(99);
  });

  it('update — calls PATCH /api/campaigns/:id', async () => {
    mock.onPatch('/api/campaigns/1').reply(200, ok({ ...mockCampaign, name: 'Updated' }));
    const result = await campaignsApi.update(1, { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('update — throws 404 for unknown id', async () => {
    mock.onPatch('/api/campaigns/99999').reply(404, { code: 'NOT_FOUND', message: 'Not found' });
    await expect(campaignsApi.update(99999, { name: 'X' })).rejects.toMatchObject({ status: 404 });
  });

  it('delete — calls DELETE /api/campaigns/:id', async () => {
    mock.onDelete('/api/campaigns/1').reply(200, ok({ deleted: true }));
    await expect(campaignsApi.delete(1)).resolves.toBeUndefined();
  });

  it('getCategories — calls GET /api/campaigns/categories', async () => {
    mock.onGet('/api/campaigns/categories').reply(200, ok(['food', 'retail']));
    const cats = await campaignsApi.getCategories();
    expect(cats).toEqual(['food', 'retail']);
  });
});

// ---------------------------------------------------------------------------
// rewardsApi
// ---------------------------------------------------------------------------

describe('rewardsApi', () => {
  const mockReward = {
    id: 1,
    name: '10% Discount',
    description: 'desc',
    points_cost: 500,
    stock: 100,
    is_active: true,
  };

  it('list — calls GET /rewards', async () => {
    mock.onGet('/rewards').reply(200, paginated([mockReward]));
    const result = await rewardsApi.list({ page: 1, limit: 10 });
    expect(result.items.length).toBe(1);
    expect(result.items[0].pointsCost).toBe(500);
    expect(result.items[0].isActive).toBe(true);
  });

  it('getById — calls GET /rewards/:id', async () => {
    mock.onGet('/rewards/1').reply(200, ok(mockReward));
    const reward = await rewardsApi.getById(1);
    expect(reward.id).toBe(1);
  });

  it('getById — throws 404', async () => {
    mock.onGet('/rewards/99999').reply(404, { code: 'NOT_FOUND', message: 'Not found' });
    await expect(rewardsApi.getById(99999)).rejects.toMatchObject({ status: 404 });
  });

  it('redeem — calls POST /redemptions', async () => {
    const mockRedemption = { id: 10, user_id: 1, reward_id: 1, points_spent: 500, created_at: '2026-01-01T00:00:00.000Z' };
    mock.onPost('/redemptions').reply(201, ok(mockRedemption));
    const result = await rewardsApi.redeem(1);
    expect(result.rewardId).toBe(1);
    expect(result.pointsSpent).toBe(500);
  });

  it('redeem — throws 404 for unknown reward', async () => {
    mock.onPost('/redemptions').reply(404, { code: 'NOT_FOUND', message: 'Not found' });
    await expect(rewardsApi.redeem(99999)).rejects.toMatchObject({ status: 404 });
  });

  it('getRedemptions — calls GET /redemptions', async () => {
    mock.onGet('/redemptions').reply(200, paginated([]));
    const result = await rewardsApi.getRedemptions({ page: 1, limit: 10 });
    expect(Array.isArray(result.items)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// transactionsApi
// ---------------------------------------------------------------------------

describe('transactionsApi', () => {
  const mockTx = {
    id: 1,
    tx_hash: 'abc123',
    tx_type: 'distribution',
    amount: 50,
    from_wallet: 'GDIST',
    to_wallet: 'GABC',
    status: 'confirmed',
    created_at: '2026-08-01T00:00:00.000Z',
  };

  it('list — calls GET /api/transactions/history', async () => {
    mock.onGet('/api/transactions/history').reply(200, paginated([mockTx]));
    const result = await transactionsApi.list(1, { limit: 25 });
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items[0].txHash).toBe('abc123');
    expect(result.items[0].txType).toBe('distribution');
  });

  it('getById — calls GET /api/transactions/:id', async () => {
    mock.onGet('/api/transactions/1').reply(200, ok(mockTx));
    const tx = await transactionsApi.getById(1);
    expect(tx.id).toBe(1);
    expect(tx.fromWallet).toBe('GDIST');
  });

  it('getById — throws 404', async () => {
    mock.onGet('/api/transactions/99999').reply(404, { code: 'NOT_FOUND', message: 'Not found' });
    await expect(transactionsApi.getById(99999)).rejects.toMatchObject({ status: 404 });
  });

  it('getStats — calls GET /api/transactions/stats', async () => {
    const stats = { total_count: 5, total_amount: 250, by_type: { distribution: 5 }, by_status: { confirmed: 5 } };
    mock.onGet('/api/transactions/stats').reply(200, ok(stats));
    const result = await transactionsApi.getStats(1);
    expect(result.totalCount).toBe(5);
    expect(result.totalAmount).toBe(250);
    expect(result.byType.distribution).toBe(5);
  });

  it('exportCsv — calls GET /api/transactions/export/csv with responseType blob', async () => {
    const csvData = 'id,txHash\n1,abc123';
    mock.onGet('/api/transactions/export/csv').reply(200, new Blob([csvData]));
    const blob = await transactionsApi.exportCsv(1);
    expect(blob).toBeInstanceOf(Blob);
  });
});

// ---------------------------------------------------------------------------
// merchantApi
// ---------------------------------------------------------------------------

describe('merchantApi', () => {
  const mockMerchant = {
    id: 2,
    name: "Bob's Co.",
    email: 'bob@nova.test',
    logo_url: null,
    website_url: 'https://bob.example.com',
    created_at: '2026-01-15T00:00:00.000Z',
  };

  it('getProfile — calls GET /api/merchant/profile', async () => {
    mock.onGet('/api/merchant/profile').reply(200, ok(mockMerchant));
    const merchant = await merchantApi.getProfile();
    expect(merchant.id).toBe(2);
    expect(merchant.email).toBe('bob@nova.test');
    expect(merchant.websiteUrl).toBe('https://bob.example.com');
  });

  it('updateProfile — calls PATCH /api/merchant/profile', async () => {
    mock.onPatch('/api/merchant/profile').reply(200, ok({ ...mockMerchant, name: "Bob's Updated" }));
    const updated = await merchantApi.updateProfile({ name: "Bob's Updated" });
    expect(updated.name).toBe("Bob's Updated");
  });

  it('getStats — calls GET /api/merchant/stats', async () => {
    const stats = { total_campaigns: 2, active_campaigns: 2, total_redemptions: 45, total_tokens_distributed: 12500 };
    mock.onGet('/api/merchant/stats').reply(200, ok(stats));
    const result = await merchantApi.getStats();
    expect(result.totalCampaigns).toBe(2);
    expect(result.activeCampaigns).toBe(2);
  });

  it('getCampaigns — calls GET /api/merchant/campaigns', async () => {
    const mockCampaign = { id: 1, merchant_id: 2, name: 'Camp', reward_rate: 1.5, start_date: '', end_date: '', on_chain_status: 'confirmed', created_at: '' };
    mock.onGet('/api/merchant/campaigns').reply(200, paginated([mockCampaign]));
    const result = await merchantApi.getCampaigns({ page: 1, limit: 10 });
    expect(Array.isArray(result.items)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// adminApi
// ---------------------------------------------------------------------------

describe('adminApi', () => {
  const mockUser = {
    id: 1,
    wallet_address: 'GABC',
    email: 'alice@nova.test',
    first_name: 'Alice',
    last_name: 'Stellar',
    role: 'user',
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('getStats — calls GET /admin/stats', async () => {
    mock.onGet('/admin/stats').reply(200, ok({
      total_users: 10,
      total_merchants: 2,
      total_tokens_issued: 50000,
      total_redemptions: 45,
      active_campaigns: 3,
    }));
    const stats = await adminApi.getStats();
    expect(stats.totalUsers).toBe(10);
    expect(stats.activeCampaigns).toBe(3);
  });

  it('listUsers — calls GET /admin/users', async () => {
    mock.onGet('/admin/users').reply(200, paginated([mockUser]));
    const result = await adminApi.listUsers({ page: 1, limit: 10 });
    expect(result.items.length).toBe(1);
    expect(result.items[0].walletAddress).toBe('GABC');
  });

  it('listUsers — passes search param', async () => {
    mock.onGet('/admin/users').reply(200, paginated([mockUser]));
    const result = await adminApi.listUsers({ search: 'alice' });
    expect(Array.isArray(result.items)).toBe(true);
    // Verify search was included in params
    const params = mock.history.get[0].params as Record<string, unknown>;
    expect(params.search).toBe('alice');
  });

  it('updateUserRole — calls PATCH /admin/users/:id/role', async () => {
    mock.onPatch('/admin/users/1/role').reply(200, ok({ ...mockUser, role: 'admin' }));
    const user = await adminApi.updateUserRole(1, 'admin');
    expect(user.role).toBe('admin');
  });

  it('updateUserRole — throws 404', async () => {
    mock.onPatch('/admin/users/99999/role').reply(404, { code: 'NOT_FOUND', message: 'Not found' });
    await expect(adminApi.updateUserRole(99999, 'admin')).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// mockApi handlers shape test
// ---------------------------------------------------------------------------

describe('mockApi.ts — handlers', () => {
  it('exports a non-empty handlers array', async () => {
    const { handlers } = await import('../lib/mockApi');
    expect(Array.isArray(handlers)).toBe(true);
    expect(handlers.length).toBeGreaterThan(10);
  });

  it('exports server, withError, withNetworkError, withSlowResponse helpers', async () => {
    const mockApiModule = await import('../lib/mockApi');
    expect(typeof mockApiModule.server).toBe('object');
    expect(typeof mockApiModule.withError).toBe('function');
    expect(typeof mockApiModule.withNetworkError).toBe('function');
    expect(typeof mockApiModule.withSlowResponse).toBe('function');
  });

  it('withError returns a RequestHandler', async () => {
    const { withError } = await import('../lib/mockApi');
    const handler = withError('/test', 503, 'Down');
    expect(handler).toBeTruthy();
    expect(typeof (handler as { isUsed?: boolean })).toBe('object');
  });
});
