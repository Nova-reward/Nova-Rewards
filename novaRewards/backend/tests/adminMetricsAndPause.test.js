/**
 * Tests for POST /admin/campaigns/:id/pause and GET /admin/metrics
 * Requirements: #583
 */

jest.mock('../db/adminRepository', () => ({
  getStats: jest.fn(),
  listUsers: jest.fn(),
  createReward: jest.fn(),
  updateReward: jest.fn(),
  deleteReward: jest.fn(),
  getRewardById: jest.fn(),
}));

jest.mock('../db/campaignRepository', () => ({
  getCampaignById: jest.fn(),
  softDeleteCampaign: jest.fn(),
}));

jest.mock('../db/index', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));

jest.mock('../services/backupService', () => ({
  listBackups: jest.fn(),
  buildRecoveryPlan: jest.fn(),
}));

jest.mock('../jobs/backupJob', () => ({
  runBackupCycle: jest.fn(),
  startBackupJob: jest.fn(),
}));

jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ success: false, error: 'unauthorized' });
    const parts = auth.substring(7).split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    req.user = { id: payload.userId, role: payload.role || 'user' };
    next();
  },
  requireAdmin: (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, error: 'forbidden' });
    next();
  },
}));

const express = require('express');
const request = require('supertest');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../routes/admin'));
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ success: false, error: err.code || 'internal_error', message: err.message });
  });
  return app;
}

const campaignRepo = require('../db/campaignRepository');
const { query } = require('../db/index');

function makeToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer header.${encoded}.sig`;
}

const ADMIN_TOKEN = makeToken({ userId: 1, role: 'admin' });
const USER_TOKEN  = makeToken({ userId: 2, role: 'user' });

const MOCK_CAMPAIGN = { id: 3, name: 'Summer Sale', is_active: true, deleted_at: null };

beforeEach(() => jest.clearAllMocks());

// ── POST /api/admin/campaigns/:id/pause ──────────────────────────────────────

describe('POST /api/admin/campaigns/:id/pause', () => {
  test('200 - pauses campaign and logs audit', async () => {
    campaignRepo.getCampaignById.mockResolvedValue(MOCK_CAMPAIGN);
    campaignRepo.softDeleteCampaign.mockResolvedValue({
      ...MOCK_CAMPAIGN, is_active: false, deleted_at: new Date().toISOString(),
    });
    query.mockResolvedValue({ rows: [{ id: 1 }] }); // audit log insert

    const res = await request(buildApp())
      .post('/api/admin/campaigns/3/pause')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(campaignRepo.softDeleteCampaign).toHaveBeenCalledWith(3, null);
  });

  test('404 - campaign not found', async () => {
    campaignRepo.getCampaignById.mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/admin/campaigns/999/pause')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('403 - non-admin rejected', async () => {
    const res = await request(buildApp())
      .post('/api/admin/campaigns/3/pause')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(403);
  });

  test('400 - invalid id', async () => {
    const res = await request(buildApp())
      .post('/api/admin/campaigns/abc/pause')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(400);
  });
});

// ── GET /api/admin/metrics ────────────────────────────────────────────────────

describe('GET /api/admin/metrics', () => {
  const MOCK_METRICS = {
    total_users: '150',
    active_campaigns: '5',
    total_campaigns: '12',
    total_rewards_issued: '50000',
    total_redemptions: '320',
    total_points_redeemed: '16000',
    active_rewards: '8',
  };

  test('200 - returns platform KPIs', async () => {
    query
      .mockResolvedValueOnce({ rows: [MOCK_METRICS] })  // metrics query
      .mockResolvedValue({ rows: [{ id: 1 }] });         // audit log insert

    const res = await request(buildApp())
      .get('/api/admin/metrics')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total_users).toBe('150');
    expect(res.body.data.active_campaigns).toBe('5');
    expect(res.body.data.total_rewards_issued).toBe('50000');
  });

  test('403 - non-admin rejected', async () => {
    const res = await request(buildApp())
      .get('/api/admin/metrics')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(403);
  });
});
