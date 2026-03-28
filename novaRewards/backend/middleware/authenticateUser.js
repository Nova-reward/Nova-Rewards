const { query } = require('../db/index');
const { verifyToken } = require('../services/tokenService');

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
 * Requirements: 183.1
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
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
