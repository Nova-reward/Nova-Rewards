/**
 * Nova Rewards — Mock API (MSW handlers + in-memory store)
 *
 * Provides a fully functional mock API for:
 *  - Local development without a running backend
 *  - Jest unit / integration tests
 *  - Storybook stories
 *
 * Built on Mock Service Worker (msw) with realistic response shapes,
 * configurable latency simulation, and error injection helpers.
 *
 * Usage — in tests:
 *   import { server } from '@/lib/mockApi';
 *   beforeAll(() => server.listen());
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 *   // Inject a one-off error:
 *   import { withError } from '@/lib/mockApi';
 *   server.use(withError('/auth/login', 401, 'Invalid credentials'));
 *
 * Usage — in browser (dev):
 *   import { startMockServiceWorker } from '@/lib/mockApi';
 *   await startMockServiceWorker();
 */

import { http, HttpResponse, delay, RequestHandler } from 'msw';
import { setupServer } from 'msw/node';

// ---------------------------------------------------------------------------
// Latency simulation
// ---------------------------------------------------------------------------

/** Simulate realistic network latency in development */
const MOCK_LATENCY_MS =
  process.env.MOCK_API_LATENCY !== undefined
    ? Number(process.env.MOCK_API_LATENCY)
    : process.env.NODE_ENV === 'test'
    ? 0
    : 120;

async function mockDelay(): Promise<void> {
  if (MOCK_LATENCY_MS > 0) await delay(MOCK_LATENCY_MS);
}

// ---------------------------------------------------------------------------
// In-memory data store
// ---------------------------------------------------------------------------

const DB = {
  users: [
    {
      id: 1,
      walletAddress: 'GABC...TEST1',
      email: 'alice@nova.test',
      firstName: 'Alice',
      lastName: 'Stellar',
      role: 'user' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      walletAddress: 'GDEF...TEST2',
      email: 'bob@nova.test',
      firstName: 'Bob',
      lastName: 'Lumens',
      role: 'merchant' as const,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 3,
      walletAddress: 'GADM...ADMIN',
      email: 'admin@nova.test',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'admin' as const,
      createdAt: '2025-12-01T00:00:00.000Z',
    },
  ],

  campaigns: [
    {
      id: 1,
      merchantId: 2,
      name: 'Summer Coffee Rewards',
      description: 'Earn 2x NOVA on every coffee purchase',
      category: 'food',
      rewardType: 'token',
      rewardRate: 2.0,
      merchantName: "Bob's Café",
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-09-01T00:00:00.000Z',
      status: 'active',
      participantCount: 142,
      tags: ['coffee', 'summer'],
      createdAt: '2026-05-15T00:00:00.000Z',
    },
    {
      id: 2,
      merchantId: 2,
      name: 'Retail Cashback Q3',
      description: '5 % cashback on all retail purchases',
      category: 'retail',
      rewardType: 'cashback',
      rewardRate: 5.0,
      merchantName: "Bob's Store",
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-09-30T00:00:00.000Z',
      status: 'active',
      participantCount: 89,
      tags: ['cashback', 'retail'],
      createdAt: '2026-06-20T00:00:00.000Z',
    },
  ],

  rewards: [
    {
      id: 1,
      name: '10 % Discount Voucher',
      description: 'Get 10% off your next purchase',
      pointsCost: 500,
      stock: 100,
      isActive: true,
    },
    {
      id: 2,
      name: 'Free Coffee',
      description: 'Redeem for a free medium coffee',
      pointsCost: 250,
      stock: 50,
      isActive: true,
    },
    {
      id: 3,
      name: 'Premium Tote Bag',
      description: 'Exclusive Nova Rewards branded tote',
      pointsCost: 1500,
      stock: 20,
      isActive: true,
    },
  ],

  transactions: [
    {
      id: 1,
      txHash: 'abc123def456',
      txType: 'distribution' as const,
      amount: 50,
      fromWallet: 'GDIST...MAIN',
      toWallet: 'GABC...TEST1',
      status: 'confirmed' as const,
      createdAt: '2026-08-01T10:00:00.000Z',
    },
    {
      id: 2,
      txHash: 'xyz789uvw012',
      txType: 'redemption' as const,
      amount: 500,
      fromWallet: 'GABC...TEST1',
      toWallet: 'GMERCHANT...MAIN',
      status: 'confirmed' as const,
      createdAt: '2026-08-05T14:30:00.000Z',
    },
  ],

  tokens: new Map<string, { token: string; refreshToken: string }>(),

  nextId: 100,
};

// ---------------------------------------------------------------------------
// Helper: build an API envelope
// ---------------------------------------------------------------------------

function ok<T>(data: T) {
  return { success: true, data };
}

function paginated<T>(
  items: T[],
  page = 1,
  limit = 10,
  total?: number,
) {
  const start = (page - 1) * limit;
  const slice = items.slice(start, start + limit);
  return {
    success: true,
    data: slice,
    page,
    limit,
    total: total ?? items.length,
    hasMore: start + limit < (total ?? items.length),
  };
}

// ---------------------------------------------------------------------------
// Mock handlers
// ---------------------------------------------------------------------------

export const handlers: RequestHandler[] = [
  // ── Auth ──────────────────────────────────────────────────────────────────

  http.post('/auth/login', async ({ request }) => {
    await mockDelay();
    const body = (await request.json()) as { email?: string; password?: string };
    const user = DB.users.find((u) => u.email === body.email);
    if (!user || body.password !== 'password123') {
      return HttpResponse.json(
        { success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        { status: 401 },
      );
    }
    const tokenPair = {
      token: `mock-token-${user.id}-${Date.now()}`,
      refreshToken: `mock-refresh-${user.id}-${Date.now()}`,
    };
    DB.tokens.set(tokenPair.refreshToken, tokenPair);
    return HttpResponse.json(
      ok({ user, tokens: { ...tokenPair, expiresIn: 3600 } }),
    );
  }),

  http.post('/auth/register', async ({ request }) => {
    await mockDelay();
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      walletAddress?: string;
    };
    if (DB.users.some((u) => u.email === body.email)) {
      return HttpResponse.json(
        { success: false, code: 'EMAIL_EXISTS', message: 'Email already registered' },
        { status: 409 },
      );
    }
    const newUser = {
      id: DB.nextId++,
      walletAddress: body.walletAddress ?? '',
      email: body.email ?? '',
      firstName: body.firstName ?? '',
      lastName: body.lastName ?? '',
      role: 'user' as const,
      createdAt: new Date().toISOString(),
    };
    DB.users.push(newUser);
    const tokenPair = {
      token: `mock-token-${newUser.id}-${Date.now()}`,
      refreshToken: `mock-refresh-${newUser.id}-${Date.now()}`,
    };
    return HttpResponse.json(
      ok({ user: newUser, tokens: { ...tokenPair, expiresIn: 3600 } }),
      { status: 201 },
    );
  }),

  http.post('/auth/refresh', async ({ request }) => {
    await mockDelay();
    const body = (await request.json()) as { refreshToken?: string };
    if (!body.refreshToken || !DB.tokens.has(body.refreshToken)) {
      return HttpResponse.json(
        { success: false, code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' },
        { status: 401 },
      );
    }
    const newToken = `mock-token-refreshed-${Date.now()}`;
    return HttpResponse.json(
      ok({ token: newToken, refreshToken: body.refreshToken, expiresIn: 3600 }),
    );
  }),

  http.post('/auth/logout', async () => {
    await mockDelay();
    return HttpResponse.json(ok({ message: 'Logged out successfully' }));
  }),

  http.post('/auth/password-reset/request', async () => {
    await mockDelay();
    return HttpResponse.json(ok({ message: 'Password reset email sent' }));
  }),

  http.post('/auth/password-reset/confirm', async () => {
    await mockDelay();
    return HttpResponse.json(ok({ message: 'Password reset successfully' }));
  }),

  // ── Users ─────────────────────────────────────────────────────────────────

  http.get('/users/me', async () => {
    await mockDelay();
    return HttpResponse.json(ok(DB.users[0]));
  }),

  http.get('/users/:id', async ({ params }) => {
    await mockDelay();
    const user = DB.users.find((u) => u.id === Number(params.id));
    if (!user) {
      return HttpResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'User not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json(ok(user));
  }),

  http.patch('/users/profile', async ({ request }) => {
    await mockDelay();
    const body = (await request.json()) as Partial<(typeof DB.users)[0]>;
    Object.assign(DB.users[0], body);
    return HttpResponse.json(ok(DB.users[0]));
  }),

  http.get('/users/:id/balance', async ({ params }) => {
    await mockDelay();
    return HttpResponse.json(
      ok({
        walletAddress: DB.users[Number(params.id) - 1]?.walletAddress ?? '',
        novaBalance: '1250.5000000',
        pointsBalance: 2400,
        lastUpdatedAt: new Date().toISOString(),
      }),
    );
  }),

  http.get('/users/leaderboard', async ({ request }) => {
    await mockDelay();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    return HttpResponse.json(paginated(DB.users, page, limit));
  }),

  // ── Campaigns ─────────────────────────────────────────────────────────────

  http.get('/api/campaigns/public', async ({ request }) => {
    await mockDelay();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    let filtered = DB.campaigns;
    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search),
      );
    }
    return HttpResponse.json(paginated(filtered, page, limit));
  }),

  http.get('/api/campaigns/public/:id', async ({ params }) => {
    await mockDelay();
    const campaign = DB.campaigns.find((c) => c.id === Number(params.id));
    if (!campaign) {
      return HttpResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Campaign not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json(ok(campaign));
  }),

  http.get('/api/campaigns/categories', async () => {
    await mockDelay();
    const cats = [...new Set(DB.campaigns.map((c) => c.category))];
    return HttpResponse.json(ok(cats));
  }),

  http.post('/api/campaigns', async ({ request }) => {
    await mockDelay();
    const body = (await request.json()) as Partial<(typeof DB.campaigns)[0]>;
    const newCampaign = {
      id: DB.nextId++,
      merchantId: 2,
      name: body.name ?? 'Unnamed Campaign',
      description: body.description ?? '',
      category: body.category ?? '',
      rewardType: body.rewardType ?? 'token',
      rewardRate: body.rewardRate ?? 1,
      merchantName: "Bob's Store",
      startDate: body.startDate ?? new Date().toISOString(),
      endDate: body.endDate ?? new Date().toISOString(),
      status: 'active',
      participantCount: 0,
      tags: body.tags ?? [],
      createdAt: new Date().toISOString(),
    };
    DB.campaigns.push(newCampaign);
    return HttpResponse.json(ok(newCampaign), { status: 201 });
  }),

  http.patch('/api/campaigns/:id', async ({ params, request }) => {
    await mockDelay();
    const idx = DB.campaigns.findIndex((c) => c.id === Number(params.id));
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Campaign not found' },
        { status: 404 },
      );
    }
    const body = (await request.json()) as Partial<(typeof DB.campaigns)[0]>;
    Object.assign(DB.campaigns[idx], body);
    return HttpResponse.json(ok(DB.campaigns[idx]));
  }),

  http.delete('/api/campaigns/:id', async ({ params }) => {
    await mockDelay();
    const idx = DB.campaigns.findIndex((c) => c.id === Number(params.id));
    if (idx !== -1) DB.campaigns.splice(idx, 1);
    return HttpResponse.json(ok({ deleted: true }));
  }),

  // ── Rewards ───────────────────────────────────────────────────────────────

  http.get('/rewards', async ({ request }) => {
    await mockDelay();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    return HttpResponse.json(paginated(DB.rewards, page, limit));
  }),

  http.get('/rewards/:id', async ({ params }) => {
    await mockDelay();
    const reward = DB.rewards.find((r) => r.id === Number(params.id));
    if (!reward) {
      return HttpResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Reward not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json(ok(reward));
  }),

  http.post('/redemptions', async ({ request }) => {
    await mockDelay();
    const body = (await request.json()) as { rewardId?: number };
    const reward = DB.rewards.find((r) => r.id === body.rewardId);
    if (!reward) {
      return HttpResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Reward not found' },
        { status: 404 },
      );
    }
    if (reward.stock !== undefined && reward.stock <= 0) {
      return HttpResponse.json(
        { success: false, code: 'OUT_OF_STOCK', message: 'This reward is out of stock' },
        { status: 409 },
      );
    }
    if (reward.stock !== undefined) reward.stock -= 1;
    const redemption = {
      id: DB.nextId++,
      userId: 1,
      rewardId: reward.id,
      pointsSpent: reward.pointsCost,
      createdAt: new Date().toISOString(),
    };
    return HttpResponse.json(ok(redemption), { status: 201 });
  }),

  http.get('/redemptions', async ({ request }) => {
    await mockDelay();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    return HttpResponse.json(paginated([], page, limit));
  }),

  // ── Transactions ──────────────────────────────────────────────────────────

  http.get('/api/transactions/history', async ({ request }) => {
    await mockDelay();
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 25);
    const page = Number(url.searchParams.get('page') ?? 1);
    return HttpResponse.json(paginated(DB.transactions, page, limit));
  }),

  http.get('/api/transactions/:id', async ({ params }) => {
    await mockDelay();
    const tx = DB.transactions.find((t) => t.id === Number(params.id));
    if (!tx) {
      return HttpResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Transaction not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json(ok(tx));
  }),

  http.get('/api/transactions/stats', async () => {
    await mockDelay();
    return HttpResponse.json(
      ok({
        totalCount: DB.transactions.length,
        totalAmount: DB.transactions.reduce((s, t) => s + (t.amount ?? 0), 0),
        byType: { distribution: 1, redemption: 1 },
        byStatus: { confirmed: 2 },
      }),
    );
  }),

  http.get('/api/transactions/export/csv', async () => {
    await mockDelay();
    const csv = [
      'id,txHash,txType,amount,status,createdAt',
      ...DB.transactions.map(
        (t) => `${t.id},${t.txHash},${t.txType},${t.amount ?? ''},${t.status},${t.createdAt}`,
      ),
    ].join('\n');
    return new HttpResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="transactions.csv"',
      },
    });
  }),

  // ── Merchant ──────────────────────────────────────────────────────────────

  http.get('/api/merchant/profile', async () => {
    await mockDelay();
    return HttpResponse.json(
      ok({
        id: 2,
        name: "Bob's Rewards Co.",
        email: 'bob@nova.test',
        logoUrl: null,
        websiteUrl: 'https://bob.example.com',
        createdAt: '2026-01-15T00:00:00.000Z',
      }),
    );
  }),

  http.patch('/api/merchant/profile', async ({ request }) => {
    await mockDelay();
    const body = await request.json();
    return HttpResponse.json(ok({ id: 2, ...body }));
  }),

  http.get('/api/merchant/stats', async () => {
    await mockDelay();
    return HttpResponse.json(
      ok({
        totalCampaigns: 2,
        activeCampaigns: 2,
        totalRedemptions: 45,
        totalTokensDistributed: 12_500,
      }),
    );
  }),

  http.get('/api/merchant/campaigns', async ({ request }) => {
    await mockDelay();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    return HttpResponse.json(paginated(DB.campaigns, page, limit));
  }),

  // ── Admin ─────────────────────────────────────────────────────────────────

  http.get('/admin/stats', async () => {
    await mockDelay();
    return HttpResponse.json(
      ok({
        totalUsers: DB.users.length,
        totalMerchants: 1,
        totalTokensIssued: 50_000,
        totalRedemptions: 45,
        activeCampaigns: 2,
      }),
    );
  }),

  http.get('/admin/users', async ({ request }) => {
    await mockDelay();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    let filtered = DB.users;
    if (search) {
      filtered = filtered.filter(
        (u) =>
          u.email.toLowerCase().includes(search) ||
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(search),
      );
    }
    return HttpResponse.json(paginated(filtered, page, limit));
  }),

  http.patch('/admin/users/:id/role', async ({ params, request }) => {
    await mockDelay();
    const body = (await request.json()) as { role?: (typeof DB.users)[0]['role'] };
    const user = DB.users.find((u) => u.id === Number(params.id));
    if (!user) {
      return HttpResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'User not found' },
        { status: 404 },
      );
    }
    if (body.role) user.role = body.role;
    return HttpResponse.json(ok(user));
  }),
];

// ---------------------------------------------------------------------------
// MSW server (Node — used in Jest)
// ---------------------------------------------------------------------------

export const server = setupServer(...handlers);

// ---------------------------------------------------------------------------
// Error injection helpers
// ---------------------------------------------------------------------------

/**
 * Returns an MSW handler that responds with an error for a specific path.
 * Use with `server.use(withError(...))` inside individual tests.
 *
 * @example
 * server.use(withError('/auth/login', 401, 'Invalid credentials'));
 */
export function withError(
  path: string,
  status: number,
  message: string,
  code = 'ERROR',
): RequestHandler {
  return http.all(path, async () => {
    await mockDelay();
    return HttpResponse.json({ success: false, code, message }, { status });
  });
}

/**
 * Returns an MSW handler that simulates a network timeout / offline error.
 */
export function withNetworkError(path: string): RequestHandler {
  return http.all(path, () => HttpResponse.error());
}

/**
 * Returns an MSW handler that simulates a slow response.
 */
export function withSlowResponse(
  path: string,
  delayMs = 5000,
  status = 200,
): RequestHandler {
  return http.all(path, async () => {
    await delay(delayMs);
    return HttpResponse.json({ success: true, data: {} }, { status });
  });
}

// ---------------------------------------------------------------------------
// Browser mock worker (development)
// ---------------------------------------------------------------------------

/**
 * Start the MSW Service Worker in the browser (dev mode only).
 * Call this at the top of _app.tsx when `NEXT_PUBLIC_MOCK_API=true`.
 *
 * @example
 * if (process.env.NEXT_PUBLIC_MOCK_API === 'true') {
 *   await startMockServiceWorker();
 * }
 */
export async function startMockServiceWorker(): Promise<void> {
  if (typeof window === 'undefined') return;

  const { setupWorker } = await import('msw/browser');
  const worker = setupWorker(...handlers);
  await worker.start({
    onUnhandledRequest: 'bypass', // Let real requests through
  });
  console.info('[MockAPI] Service Worker started — all API calls are intercepted');
}
