# Audit Logging Endpoints

## GET /api/admin/audit-logs

Retrieve paginated audit logs with filtering and search capabilities.

**Authentication:** Admin token required (Bearer token)

**Query Parameters:**
- `entityType` (string, optional) - Filter by resource type
- `entityId` (integer, optional) - Filter by resource ID
- `performedBy` (integer, optional) - Filter by user ID
- `actorType` (string, optional) - Filter by actor type (user|admin|merchant|system)
- `action` (string, optional) - Filter by action name
- `ipAddress` (string, optional) - Filter by client IP
- `httpMethod` (string, optional) - Filter by HTTP method
- `endpoint` (string, optional) - Filter by endpoint path
- `statusCode` (integer, optional) - Filter by HTTP status code
- `startDate` (ISO 8601, optional) - Filter from date
- `endDate` (ISO 8601, optional) - Filter to date
- `page` (integer, default=1) - Page number
- `limit` (integer, default=20, max=100) - Records per page

**Success Response (200):**
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
        "merchant_id": null,
        "ip_address": "192.0.2.1",
        "user_agent": "Mozilla/5.0...",
        "http_method": "POST",
        "endpoint": "/api/campaigns",
        "status_code": 201,
        "duration_ms": 145,
        "details": { "body": {...}, "query": {...} },
        "source": "POST /api/campaigns",
        "before_state": null,
        "after_state": {...},
        "created_at": "2025-06-20T10:30:00Z"
      }
    ],
    "total": 1250,
    "page": 1,
    "limit": 20
  }
}
```

**Error Responses:**
- 401 Unauthorized (not authenticated)
- 403 Forbidden (not admin)

**Examples:**

```bash
# Get recent logs
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs"

# Filter by campaign creation
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs?entityType=campaign&action=create_campaign"

# Find specific user's actions
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs?performedBy=5&page=1&limit=50"

# Date range query
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs?startDate=2025-06-01T00:00:00Z&endDate=2025-06-30T23:59:59Z"

# Find failed operations
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs?statusCode=400&statusCode=401&statusCode=403"
```

---

## GET /api/admin/audit-logs/export

Export filtered audit logs as CSV for compliance reporting and analysis.

**Authentication:** Admin token required (Bearer token)

**Query Parameters:**
Same as GET /api/admin/audit-logs, except:
- No `page` or `limit` parameters (entire result set exported)

**Success Response (200):**
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="audit-logs-YYYY-MM-DD.csv"`
- Body: CSV file with headers and data rows

**CSV Columns:**
```
ID,Timestamp,Actor Type,Performed By,Merchant ID,Entity Type,Entity ID,Action,HTTP Method,Endpoint,Status Code,Duration (ms),IP Address,User Agent,Source,Details
```

**Error Responses:**
- 401 Unauthorized (not authenticated)
- 403 Forbidden (not admin)

**Examples:**

```bash
# Export all logs
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs/export" \
  > audit-logs-full.csv

# Export campaign changes
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs/export?entityType=campaign" \
  > audit-logs-campaigns.csv

# Export by date range
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs/export?startDate=2025-01-01T00:00:00Z&endDate=2025-12-31T23:59:59Z" \
  > audit-logs-2025.csv

# Export admin actions
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/admin/audit-logs/export?actorType=admin" \
  > audit-logs-admins.csv
```

---

## What Gets Logged Automatically

**Write Operations (Logged):**
- POST /api/* (create operations)
- PUT /api/* (replace operations)
- PATCH /api/* (update operations)
- DELETE /api/* (delete operations)

**Read Operations (Not Logged):**
- GET /api/* (queries don't need audit trail)

**Special Endpoints (Not Logged):**
- /health (health checks)
- /metrics (prometheus metrics)
- /api/docs (documentation)
- /api/leaderboard (read-only)
- /api/search (read-only)

**Sensitive Fields (Redacted):**
- password, password_hash, currentPassword, newPassword, confirmPassword
- token, accessToken, refreshToken
- secret, api_key, apiKey
- authorization
- credit_card, cvv, ssn

---

## Data Retention

- **Minimum Retention:** 1 year (compliance requirement)
- **Actual Retention:** Indefinite (for forensic analysis)
- **Deletion:** Prevented by database constraints
- **Archival:** Can be exported and archived separately

---

## Performance

- **Response Impact:** <1ms (non-blocking writes)
- **Storage:** ~10KB per log entry (varies with details size)
- **Query Time:** <100ms for typical queries (indexed lookups)
- **Concurrent Writes:** Handles 1000+ requests/second

---

## Security

- **Access Control:** Admin role required
- **Data Protection:** Sensitive fields automatically redacted
- **Integrity:** Logs cannot be modified or deleted
- **Auditability:** Complete metadata captured for forensic analysis
- **Privacy:** PII redacted appropriately
