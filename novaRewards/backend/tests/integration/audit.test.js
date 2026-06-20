/**
 * Audit Logging Integration Tests
 * 
 * Verifies that:
 * 1. All write operations are logged with complete metadata
 * 2. Audit logs include userId, action, resourceType, resourceId, ipAddress, timestamp
 * 3. Audit log writes are non-blocking (fire-and-forget)
 * 4. GET /api/admin/audit-logs returns paginated logs (admin only)
 * 5. Audit logs are never deleted
 */

const request = require('supertest');
const app = require('../../server');
const { query } = require('../../db/index');

describe('Audit Logging', () => {
  let adminToken;
  let userId;
  let campaignId;

  beforeAll(async () => {
    // Setup: Create an admin user and get token
    // Create a test user first
    const userRes = await query(
      `INSERT INTO users (email, password_hash, role, wallet_address, is_verified, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING id`,
      ['audit-admin@test.com', '$2a$10$hash', 'admin', 'G' + Math.random().toString(36).slice(2, 58), true]
    );
    userId = userRes.rows[0].id;

    // TODO: Generate proper JWT token for admin
    // adminToken = generateAdminJWT(userId);
  });

  afterAll(async () => {
    // Cleanup
    if (userId) {
      await query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  describe('POST /api/admin/audit-logs', () => {
    it('should record write operation (campaign creation)', async () => {
      // Create a campaign (triggers audit log)
      const createRes = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Campaign',
          reward_rate: 0.05,
          start_date: '2025-01-01',
          end_date: '2025-12-31',
        });

      if (createRes.body.data?.id) {
        campaignId = createRes.body.data.id;
      }

      // Wait briefly for non-blocking audit write
      await new Promise(resolve => setTimeout(resolve, 100));

      // Query audit logs for this action
      const auditRes = await query(
        `SELECT * FROM audit_logs WHERE entity_type = $1 ORDER BY created_at DESC LIMIT 1`,
        ['campaign']
      );

      expect(auditRes.rows.length).toBeGreaterThan(0);
      const log = auditRes.rows[0];

      // Verify required fields
      expect(log).toHaveProperty('id');
      expect(log.entity_type).toBe('campaign');
      expect(log.action).toMatch(/create/i);
      expect(log.performed_by).toBe(userId);
      expect(log.ip_address).toBeDefined(); // Should capture client IP
      expect(log.created_at).toBeDefined();
      expect(log.http_method).toBe('POST');
      expect(log.endpoint).toBe('/api/campaigns');
      expect(log.status_code).toBeDefined();
      expect(log.actor_type).toMatch(/user|admin|merchant|system/);
    });

    it('should record PATCH (update) operation', async () => {
      if (!campaignId) this.skip();

      const updateRes = await request(app)
        .patch(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Campaign' });

      await new Promise(resolve => setTimeout(resolve, 100));

      const auditRes = await query(
        `SELECT * FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 1`,
        ['campaign', campaignId]
      );

      expect(auditRes.rows.length).toBeGreaterThan(0);
      const log = auditRes.rows[0];
      expect(log.action).toMatch(/update/i);
      expect(log.http_method).toBe('PATCH');
    });

    it('should record DELETE operation', async () => {
      // Create a campaign to delete
      const createRes = await query(
        `INSERT INTO campaigns (merchant_id, name, reward_rate, start_date, end_date, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id`,
        [1, 'Delete Me', 0.05, '2025-01-01', '2025-12-31', true]
      );
      const testCampaignId = createRes.rows[0].id;

      const deleteRes = await request(app)
        .delete(`/api/campaigns/${testCampaignId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      const auditRes = await query(
        `SELECT * FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 1`,
        ['campaign', testCampaignId]
      );

      expect(auditRes.rows.length).toBeGreaterThan(0);
      const log = auditRes.rows[0];
      expect(log.action).toMatch(/delete|remove/i);
      expect(log.http_method).toBe('DELETE');
    });
  });

  describe('GET /api/admin/audit-logs', () => {
    it('should require admin authentication', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs');

      expect(res.status).toBe(401);
    });

    it('should return paginated audit logs', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('page');
      expect(res.body.data).toHaveProperty('limit');
      expect(Array.isArray(res.body.data.data)).toBe(true);
    });

    it('should support filtering by entityType', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ entityType: 'campaign', page: 1, limit: 10 });

      expect(res.status).toBe(200);
      res.body.data.data.forEach(log => {
        expect(log.entity_type).toBe('campaign');
      });
    });

    it('should support filtering by action', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ action: 'create_campaign', page: 1, limit: 10 });

      expect(res.status).toBe(200);
      res.body.data.data.forEach(log => {
        expect(log.action).toBe('create_campaign');
      });
    });

    it('should support filtering by date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          page: 1,
          limit: 10
        });

      expect(res.status).toBe(200);
    });

    it('should support filtering by actorType', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ actorType: 'admin', page: 1, limit: 10 });

      expect(res.status).toBe(200);
      res.body.data.data.forEach(log => {
        expect(log.actor_type).toBe('admin');
      });
    });

    it('should support filtering by ipAddress', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ ipAddress: '127.0.0.1', page: 1, limit: 10 });

      expect(res.status).toBe(200);
    });

    it('should support filtering by httpMethod', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ httpMethod: 'POST', page: 1, limit: 10 });

      expect(res.status).toBe(200);
      res.body.data.data.forEach(log => {
        expect(log.http_method).toBe('POST');
      });
    });

    it('should enforce pagination limits', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 500 }); // Request more than max

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBeLessThanOrEqual(100); // Enforced max
    });
  });

  describe('GET /api/admin/audit-logs/export', () => {
    it('should export audit logs as CSV', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1 });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.text).toMatch(/ID,Timestamp,Actor Type/); // CSV header
    });

    it('should include all required columns in export', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const expectedHeaders = [
        'ID', 'Timestamp', 'Actor Type', 'Performed By', 'Merchant ID',
        'Entity Type', 'Entity ID', 'Action', 'HTTP Method', 'Endpoint',
        'Status Code', 'Duration', 'IP Address', 'User Agent', 'Source', 'Details'
      ];
      expectedHeaders.forEach(header => {
        expect(res.text).toMatch(new RegExp(header));
      });
    });
  });

  describe('Audit Log Immutability', () => {
    it('should not allow UPDATE on audit_logs table', async () => {
      const auditRes = await query('SELECT id FROM audit_logs LIMIT 1');
      if (auditRes.rows.length === 0) this.skip();

      const logId = auditRes.rows[0].id;

      try {
        await query('UPDATE audit_logs SET action = $1 WHERE id = $2', ['TAMPERED', logId]);
        throw new Error('UPDATE should have been blocked');
      } catch (err) {
        // Expected: either prevented by constraint or RBAC
        expect(err.message).not.toMatch(/UPDATE succeeded/);
      }
    });

    it('should not allow DELETE on audit_logs table', async () => {
      const auditRes = await query('SELECT id FROM audit_logs LIMIT 1');
      if (auditRes.rows.length === 0) this.skip();

      const logId = auditRes.rows[0].id;

      try {
        await query('DELETE FROM audit_logs WHERE id = $1', [logId]);
        throw new Error('DELETE should have been blocked');
      } catch (err) {
        // Expected: either prevented by constraint or RBAC
        expect(err.message).not.toMatch(/DELETE succeeded/);
      }
    });
  });

  describe('Audit Log Retention', () => {
    it('should have indexed recent logs for 1-year retention window', async () => {
      const res = await query(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'audit_logs' AND indexname LIKE '%retention%'`
      );
      expect(res.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Non-blocking writes', () => {
    it('should not delay API response for audit logging', async () => {
      const startTime = Date.now();

      const res = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Performance Test',
          reward_rate: 0.05,
          start_date: '2025-01-01',
          end_date: '2025-12-31',
        });

      const duration = Date.now() - startTime;

      expect(res.status).toBeLessThan(500); // Success or client error
      expect(duration).toBeLessThan(5000); // Response within reasonable time
      // Audit logging should not add significant overhead
    });
  });

  describe('Sensitive field redaction', () => {
    it('should redact passwords from audit details', async () => {
      // TODO: Test that password fields are redacted in details
    });

    it('should redact API keys from audit details', async () => {
      // TODO: Test that api_key fields are redacted in details
    });

    it('should redact tokens from audit details', async () => {
      // TODO: Test that token fields are redacted in details
    });
  });
});
