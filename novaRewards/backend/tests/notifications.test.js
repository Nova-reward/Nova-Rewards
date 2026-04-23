/**
 * Tests for GET/PATCH /api/notifications and NotificationService.send()
 * Requirements: #582
 */

jest.mock('../db/notificationRepository', () => ({
  getNotificationsForUser: jest.fn(),
  markNotificationAsRead: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
  createNotification: jest.fn(),
}));

jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../db/index', () => ({ query: jest.fn(), pool: { connect: jest.fn() } }));

jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ success: false, error: 'unauthorized' });
    const parts = auth.substring(7).split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    req.user = { id: payload.userId, role: payload.role || 'user' };
    next();
  },
}));

const express = require('express');
const request = require('supertest');

// Build a minimal app with only the notifications router
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', require('../routes/notifications'));
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ success: false, error: err.code || 'internal_error', message: err.message });
  });
  return app;
}

const notifRepo = require('../db/notificationRepository');
const { query } = require('../db/index');

function makeToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer header.${encoded}.sig`;
}

const USER_TOKEN = makeToken({ userId: 1, role: 'user' });

const MOCK_NOTIFICATION = {
  id: 1,
  user_id: 1,
  type: 'reward_received',
  title: 'Reward Received',
  message: 'You got 100 NOVA',
  is_read: false,
  created_at: new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

// ── GET /api/notifications ───────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  test('200 - returns paginated notifications', async () => {
    notifRepo.getNotificationsForUser.mockResolvedValue({
      data: [MOCK_NOTIFICATION],
      total: 1,
      page: 1,
      limit: 20,
    });

    const res = await request(buildApp())
      .get('/api/notifications')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(notifRepo.getNotificationsForUser).toHaveBeenCalledWith(1, { page: 1, limit: 20 });
  });

  test('401 - unauthenticated', async () => {
    const res = await request(buildApp()).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────

describe('PATCH /api/notifications/:id/read', () => {
  test('200 - marks notification as read', async () => {
    notifRepo.markNotificationAsRead.mockResolvedValue({ ...MOCK_NOTIFICATION, is_read: true });

    const res = await request(buildApp())
      .patch('/api/notifications/1/read')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.data.is_read).toBe(true);
    expect(notifRepo.markNotificationAsRead).toHaveBeenCalledWith(1);
  });

  test('404 - notification not found', async () => {
    notifRepo.markNotificationAsRead.mockResolvedValue(null);

    const res = await request(buildApp())
      .patch('/api/notifications/999/read')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('400 - invalid id', async () => {
    const res = await request(buildApp())
      .patch('/api/notifications/abc/read')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});

// ── PATCH /api/notifications/read-all ────────────────────────────────────────

describe('PATCH /api/notifications/read-all', () => {
  test('200 - marks all as read', async () => {
    notifRepo.markAllNotificationsAsRead.mockResolvedValue();

    const res = await request(buildApp())
      .patch('/api/notifications/read-all')
      .set('Authorization', USER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(notifRepo.markAllNotificationsAsRead).toHaveBeenCalledWith(1);
  });
});

// ── NotificationService.send() ────────────────────────────────────────────────

describe('NotificationService.send()', () => {
  const { sendEmail } = require('../services/emailService');

  beforeEach(() => {
    query.mockResolvedValue({
      rows: [{
        email: 'user@example.com',
        first_name: 'Alice',
        notification_preferences: { rewards: true, redemptions: true, campaigns: false },
      }],
    });
    notifRepo.createNotification.mockResolvedValue({ id: 1 });
  });

  test('creates in-app notification and sends email for opted-in type', async () => {
    const notifService = require('../services/notificationService');
    await notifService.send(1, 'reward_received', {
      title: 'Reward!',
      message: 'You got a reward',
      rewardName: 'Coffee',
      pointsEarned: 100,
    });

    expect(notifRepo.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, type: 'reward_received' })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com', emailType: 'reward_received' })
    );
  });

  test('creates in-app notification but skips email for opted-out type', async () => {
    const notifService = require('../services/notificationService');
    await notifService.send(1, 'campaign_expiry', {
      title: 'Campaign expiring',
      message: 'Campaign ends soon',
      campaignName: 'Summer Sale',
      expiresAt: new Date().toISOString(),
    });

    expect(notifRepo.createNotification).toHaveBeenCalled();
    // campaigns opted out → no email
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('skips notification if user not found', async () => {
    query.mockResolvedValue({ rows: [] });
    const notifService = require('../services/notificationService');
    await notifService.send(999, 'reward_received', { title: 'x', message: 'y' });
    expect(notifRepo.createNotification).not.toHaveBeenCalled();
  });
});
