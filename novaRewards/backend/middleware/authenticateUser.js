const { query } = require('../db/index');
const { verifyToken } = require('../services/tokenService');
const AuditService = require('../services/auditService');
const SecurityAlertService = require('../services/securityAlertService');

/**
 * Middleware: validates JWT token from the Authorization header.
 * Attaches the user record to req.user on success.
 * Requirements: 183.1, 183.2
 */
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'Bearer token is required in Authorization header',
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = verifyToken(token);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Invalid token',
      });
    }

    const result = await query(
      `SELECT id, email, wallet_address, first_name, last_name, bio, stellar_public_key,
              role, created_at, updated_at
       FROM users
       WHERE id = $1 AND is_deleted = FALSE`,
      [decoded.userId]
    );

    if (!result.rows[0]) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'User not found or account deleted',
      });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Middleware: check if user is admin
 * Requirements: 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.5
 */
async function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    // Only log security event when we have an authenticated user
    if (req.user) {
      const event = {
        action: 'PRIVILEGE_ESCALATION_ATTEMPT',
        entityType: 'admin_endpoint',
        entityId: null,
        performedBy: req.user.id,
        source: 'api',
        details: {
          method: req.method,
          role: req.user.role,
          ip: req.ip || req.headers['x-forwarded-for'],
          entityId: req.path,
        },
      };
      try {
        await AuditService.log(event);
      } catch (auditErr) {
        console.error('[requireAdmin] AuditService failed:', auditErr);
      }
      // Fire-and-forget alert (non-blocking)
      SecurityAlertService.send({ ...event, timestamp: new Date().toISOString() })
        .catch(err => console.error('[requireAdmin] SecurityAlertService failed:', err));
    }
    return res.status(403).json({
      success: false,
      error: 'forbidden',
      message: 'Admin access required',
    });
  }
  next();
}

/**
 * Middleware: check if user owns the resource or is admin
 * Requirements: 183.1
 */
function requireOwnershipOrAdmin(req, res, next) {
  // GET requests: allow all authenticated users — route decides public vs private data
  if (req.method === 'GET') return next();
  const resourceUserId = parseInt(req.params.id);
  const currentUserId = req.user?.id;
  
  if (currentUserId !== resourceUserId && req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'forbidden',
      message: 'You can only access your own profile',
    });
  }
  next();
}

module.exports = { authenticateUser, requireAdmin, requireOwnershipOrAdmin };
