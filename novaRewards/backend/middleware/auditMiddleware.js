/**
 * Audit Middleware
 *
 * Automatically logs every API request to the audit_logs table after the
 * response is sent (non-blocking — never delays the response).
 *
 * Captures: actor identity, IP, user agent, method, endpoint, status code,
 * duration, and a sanitised request body snapshot.
 *
 * Sensitive fields (passwords, tokens, secrets) are stripped before storage.
 */

const { logAudit } = require('../db/auditLogRepository');

// Fields that must never appear in audit log details
const REDACTED_FIELDS = new Set([
  'password',
  'password_hash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'api_key',
  'apiKey',
  'authorization',
  'credit_card',
  'cvv',
  'ssn',
]);

/**
 * Recursively strips sensitive keys from an object.
 * @param {*} obj
 * @returns {*}
 */
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      REDACTED_FIELDS.has(k) ? '[REDACTED]' : sanitize(v),
    ])
  );
}

/**
 * Derives the entity type from the request path.
 * e.g. /api/users/42 → 'user'
 */
function entityTypeFromPath(path) {
  const segment = path.replace(/^\/api\//, '').split('/')[0];
  const map = {
    auth: 'auth',
    users: 'user',
    merchants: 'merchant',
    campaigns: 'campaign',
    rewards: 'reward',
    redemptions: 'redemption',
    transactions: 'transaction',
    admin: 'admin',
    drops: 'drop',
    webhooks: 'webhook',
    'contract-events': 'contract_event',
    leaderboard: 'leaderboard',
    analytics: 'analytics',
    search: 'search',
    trustline: 'trustline',
    wallet: 'wallet',
  };
  return map[segment] || segment || 'api';
}

/**
 * Derives a human-readable action from method + path.
 * e.g. POST /api/auth/login → 'login'
 *      DELETE /api/users/42 → 'delete_user'
 */
function actionFromRequest(method, path) {
  const clean = path.replace(/^\/api\//, '').replace(/\/\d+/g, '/:id');

  const knownActions = {
    'POST auth/login': 'login',
    'POST auth/register': 'register',
    'POST auth/logout': 'logout',
    'POST auth/refresh': 'token_refresh',
    'POST auth/forgot-password': 'forgot_password',
    'POST auth/reset-password': 'reset_password',
    'POST users': 'create_user',
    'PATCH users/:id': 'update_user',
    'PUT users/:id': 'update_user',
    'DELETE users/:id': 'delete_user',
    'PATCH users/:id/password': 'change_password',
    'POST users/:id/profile-picture': 'upload_avatar',
    'POST merchants/register': 'register_merchant',
    'POST campaigns': 'create_campaign',
    'PATCH campaigns/:id': 'update_campaign',
    'DELETE campaigns/:id': 'delete_campaign',
    'POST rewards/distribute': 'distribute_reward',
    'POST redemptions': 'redeem_reward',
    'POST transactions/record': 'record_transaction',
    'POST transactions/refund': 'refund_transaction',
    'POST transactions/reconcile': 'reconcile_transactions',
    'POST drops': 'create_drop',
    'POST drops/claim': 'claim_drop',
    'POST webhooks': 'create_webhook',
    'DELETE webhooks/:id': 'delete_webhook',
    'POST admin/rewards': 'admin_create_reward',
    'PATCH admin/rewards/:id': 'admin_update_reward',
    'DELETE admin/rewards/:id': 'admin_delete_reward',
    'GET admin/audit-logs': 'view_audit_logs',
    'GET admin/audit-logs/export': 'export_audit_logs',
  };

  const key = `${method} ${clean}`;
  if (knownActions[key]) return knownActions[key];

  // Fallback: derive from method
  const methodMap = { GET: 'read', POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };
  const entity = entityTypeFromPath(path);
  return `${methodMap[method] || method.toLowerCase()}_${entity}`;
}

/**
 * Determines actor type from the request.
 */
function resolveActorType(req) {
  if (req.user?.role === 'admin') return 'admin';
  if (req.merchant) return 'merchant';
  if (req.user) return 'user';
  return 'system';
}

/**
 * Extracts the real client IP, respecting common proxy headers.
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    null
  );
}

/**
 * Express middleware — attaches a post-response hook to log the request.
 * Skips health checks, metrics, and static assets.
 */
function auditMiddleware(req, res, next) {
  // Skip non-API paths and read-only endpoints that don't need auditing
  const skipPaths = ['/health', '/metrics', '/api/docs', '/api/leaderboard', '/api/search'];
  if (skipPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  // Skip pure GET reads (except admin and audit-log reads)
  const isAdminPath = req.path.startsWith('/api/admin');
  if (req.method === 'GET' && !isAdminPath) {
    return next();
  }

  const startTime = Date.now();

  res.on('finish', () => {
    // Fire-and-forget — never block the response
    setImmediate(async () => {
      try {
        const durationMs = Date.now() - startTime;
        const actorType = resolveActorType(req);
        const action = actionFromRequest(req.method, req.path);
        const entityType = entityTypeFromPath(req.path);

        // Extract entity ID from path params if present
        const entityId = req.params?.id ? parseInt(req.params.id, 10) || null : null;

        // Build sanitised details snapshot
        const details = {
          ...(Object.keys(req.body || {}).length > 0 && { body: sanitize(req.body) }),
          ...(Object.keys(req.query || {}).length > 0 && { query: sanitize(req.query) }),
          ...(req.params && Object.keys(req.params).length > 0 && { params: req.params }),
          traceId: req.traceId || null,
        };

        await logAudit({
          entityType,
          entityId,
          action,
          performedBy: req.user?.id || null,
          actorType,
          merchantId: req.merchant?.id || null,
          details,
          source: `${req.method} ${req.path}`,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'] || null,
          httpMethod: req.method,
          endpoint: req.path,
          statusCode: res.statusCode,
          durationMs,
        });
      } catch (err) {
        // Audit logging must never crash the app
        console.error('[audit] Failed to write audit log:', err.message);
      }
    });
  });

  next();
}

module.exports = { auditMiddleware, sanitize, actionFromRequest, entityTypeFromPath };
