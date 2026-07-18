# Audit Logging

## Overview

Nova Rewards maintains a complete, immutable audit trail of all write operations (POST, PUT, PATCH, DELETE) across the platform. This enables security investigations, compliance reporting, and forensic analysis.

**Key features:**
- All write operations logged automatically
- Non-blocking, fire-and-forget writes (no performance impact)
- Complete metadata: who, what, when, where (IP), HTTP context
- Paginated retrieval for compliance queries
- CSV export for reporting
- Immutable (deletion prevented by database constraints)
- 1-year minimum retention policy

## Captured Information

Each audit log entry includes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique log entry ID |
| `entity_type` | string | Resource type (campaign, user, reward, etc.) |
| `entity_id` | integer | ID of the affected resource |
| `action` | string | Human-readable action (create_campaign, update_reward, etc.) |
| `performed_by` | integer | User ID of the actor (null for system actions) |
| `actor_type` | string | Type of actor: `user`, `admin`, `merchant`, or `system` |
| `merchant_id` | integer | Merchant ID (if merchant-scoped action) |
| `ip_address` | inet | Client IP address |
| `user_agent` | text | Browser/client user agent |
| `http_method` | string | HTTP method (POST, PATCH, DELETE, etc.) |
| `endpoint` | string | HTTP endpoint path |
| `status_code` | smallint | HTTP response status code |
| `duration_ms` | integer | Request processing time in milliseconds |
| `details` | jsonb | Sanitized request body, query params, and metadata |
| `source` | string | API endpoint or internal source |
| `before_state` | jsonb | Previous state (for updates) |
| `after_state` | jsonb | New state (for updates) |
| `created_at` | timestamptz | Timestamp of the action |

## Automatic Logging

All write operations are logged automatically via the `auditMiddleware` in `middleware/auditMiddleware.js`.

**Logged operations:**
- POST requests (create operations)
- PUT requests (replace operations)
- PATCH requests (partial updates)
- DELETE requests (removals)

**Skipped operations:**
- GET requests (read-only, no audit trail needed)
- Health checks (`/health`, `/ready`)
- Metrics endpoints (`/metrics`)
- Static assets

### Field Sanitization

Sensitive fields are automatically redacted from audit details:

```javascript
const REDACTED_FIELDS = [
  'password', 'password_hash', 'currentPassword', 'newPassword',
  'token', 'accessToken', 'refreshToken',
  'secret', 'api_key', 'apiKey',
  'authorization', 'credit_card', 'cvv', 'ssn'
];
```

Example: A password change request is logged with `password: '[REDACTED]'`.

## Querying Audit Logs

### Get Logs (Paginated)

```http
GET /api/admin/audit-logs
```

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityType` | string | Filter by resource type (campaign, user, reward, etc.) |
| `entityId` | integer | Filter by resource ID |
| `performedBy` | integer | Filter by user ID |
| `actorType` | string | Filter by actor type (user, admin, merchant, system) |
| `action` | string | Filter by action name |
| `ipAddress` | string | Filter by IP address |
| `httpMethod` | string | Filter by HTTP method |
| `endpoint` | string | Filter by endpoint (substring match) |
| `statusCode` | integer | Filter by HTTP status code |
| `startDate` | ISO 8601 | Filter logs from this date |
| `endDate` | ISO 8601 | Filter logs up to this date |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Records per page (default: 20, max: 100) |

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs?entityType=campaign&actorType=admin&page=1&limit=20"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1234,
        "entity_type": "campaign",
        "entity_id": 42,
        "action": "create_campaign",
        "performed_by": 5,
        "actor_type": "admin",
        "ip_address": "192.0.2.1",
        "http_method": "POST",
        "endpoint": "/api/campaigns",
        "status_code": 201,
        "duration_ms": 145,
        "created_at": "2025-06-20T10:30:00Z",
        "details": {
          "body": { "name": "Summer Sale", "reward_rate": 0.05 },
          "traceId": "abc123"
        }
      }
    ],
    "total": 1250,
    "page": 1,
    "limit": 20
  }
}
```

### Export Logs (CSV)

```http
GET /api/admin/audit-logs/export
```

Exports all matching logs as CSV. Same filters as GET /api/admin/audit-logs apply.

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs/export?startDate=2025-01-01&endDate=2025-12-31" \
  > audit-logs-2025.csv
```

**CSV columns:**
```
ID,Timestamp,Actor Type,Performed By,Merchant ID,Entity Type,Entity ID,Action,HTTP Method,Endpoint,Status Code,Duration (ms),IP Address,User Agent,Source,Details
```

## Use Cases

### Compliance Reporting

Export logs for a date range to provide to auditors:

```bash
START_DATE="2025-01-01T00:00:00Z"
END_DATE="2025-12-31T23:59:59Z"
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs/export?startDate=$START_DATE&endDate=$END_DATE" \
  > annual-audit-report.csv
```

### Incident Investigation

Find all actions by a specific user:

```bash
USER_ID=5
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs?performedBy=$USER_ID"
```

Find all campaign changes in a specific time window:

```bash
START="2025-06-20T09:00:00Z"
END="2025-06-20T17:00:00Z"
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs?entityType=campaign&startDate=$START&endDate=$END"
```

### Security Audit

Find all failed operations (4xx/5xx status codes):

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs?statusCode=400" \
  "http://localhost:3001/api/admin/audit-logs?statusCode=401" \
  "http://localhost:3001/api/admin/audit-logs?statusCode=403"
```

Find all changes made from a specific IP:

```bash
IP="203.0.113.45"
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs?ipAddress=$IP"
```

## Data Retention

**Policy:**
- Minimum retention: 1 year
- Deletion is prohibited (database constraints enforced)
- Logs stored indefinitely for compliance

**Indexes:**
- `idx_audit_logs_created_at_desc`: Optimized for date-range queries
- `idx_audit_logs_retention_window`: Specifically indexed for 1-year retention window
- `idx_audit_logs_entity`: Fast filtering by entity type and ID
- `idx_audit_logs_action`: Fast filtering by action
- `idx_audit_logs_merchant_id`: Merchant-scoped queries

## Database Schema

```sql
CREATE TABLE audit_logs (
  id            SERIAL PRIMARY KEY,
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     INTEGER,
  action        VARCHAR(100) NOT NULL,
  performed_by  INTEGER REFERENCES users(id),
  actor_type    VARCHAR(20) DEFAULT 'user',
  merchant_id   INTEGER REFERENCES merchants(id),
  ip_address    INET,
  user_agent    TEXT,
  http_method   VARCHAR(10),
  endpoint      VARCHAR(500),
  status_code   SMALLINT,
  duration_ms   INTEGER,
  details       JSONB,
  source        VARCHAR(255),
  before_state  JSONB,
  after_state   JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CHECK (actor_type IN ('user', 'admin', 'merchant', 'system'))
);
```

## Implementation Details

### Middleware Flow

1. Request arrives at Express middleware chain
2. `auditMiddleware` extracts request metadata
3. Response is sent to client (no blocking)
4. `res.on('finish')` hook triggers asynchronously
5. Audit log is written to database (fire-and-forget)
6. On error: logged to console, never crashes the app

### Non-blocking Writes

Audit writes use `setImmediate()` to defer to the next event loop cycle:

```javascript
res.on('finish', () => {
  setImmediate(async () => {
    try {
      await logAudit({ /* ... */ });
    } catch (err) {
      console.error('[audit] Failed to write audit log:', err.message);
    }
  });
});
```

This ensures:
- API responses are never delayed by audit logging
- Audit writes happen after response is sent
- Errors in audit logging don't crash the app

### Access Control

Only admins can retrieve audit logs:

```javascript
router.get('/audit-logs', authenticateUser, requireAdmin, async (req, res) => {
  // ...
});
```

Non-admin users receive a 403 Forbidden response.

## Monitoring

### Prometheus Metrics

Check `metricsMiddleware` for audit-related metrics:
- Request duration by method/endpoint
- Status code distribution
- Error rates

### Logs

Failed audit writes are logged:
```
[audit] Failed to write audit log: Connection refused
```

## Troubleshooting

### Logs not appearing

1. Check that middleware is registered in `server.js`:
   ```javascript
   app.use(require('./middleware/auditMiddleware').auditMiddleware);
   ```

2. Verify audit_logs table exists:
   ```sql
   SELECT * FROM audit_logs LIMIT 1;
   ```

3. Check for errors in application logs:
   ```bash
   grep "\[audit\]" /var/log/nova/backend.log
   ```

### Performance concerns

Audit logging uses non-blocking writes and should have <1ms impact on response times. If experiencing issues:

1. Check database connection pool size
2. Monitor PostgreSQL slow query log
3. Verify audit_logs indexes exist
4. Consider archiving old logs (external process, does not delete)

## Security Considerations

1. **Sensitive data**: Passwords, API keys, and tokens are automatically redacted
2. **Immutability**: Database constraints prevent audit log modification/deletion
3. **Access control**: Only admins can access audit logs
4. **IP capture**: Client IP is extracted from headers (respects proxies via `X-Forwarded-For`)
5. **User agent**: Captured for device/browser context
6. **Retention**: Logs retained indefinitely for long-term forensic analysis

## Related Documentation

- [Security Best Practices](./security/security-best-practices.md)
- [Threat Model](./security/threat-model.md)
- [API Reference](./api/README.md)
