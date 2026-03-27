const { query } = require('../db/index');

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

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // In a real implementation, you would verify the JWT token here
    // For now, we'll use a simple token lookup (in production, use jsonwebtoken)
    // This is a placeholder - replace with actual JWT verification
    
    // For demonstration, we'll extract user ID from token
    // In production, decode JWT and verify signature
    const decoded = decodeToken(token);
    
    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Invalid token',
      });
    }

    // Fetch user from database
    const result = await query(
      `SELECT id, wallet_address, first_name, last_name, bio, stellar_public_key, 
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
 * Placeholder token decoder - replace with actual JWT verification
 * In production, use jsonwebtoken library to verify and decode
 * @param {string} token - JWT token
 * @returns {Object|null} - Decoded token payload
 */
function decodeToken(token) {
  try {
    // This is a placeholder - in production, use:
    // const jwt = require('jsonwebtoken');
    // return jwt.verify(token, process.env.JWT_SECRET);
    
    // For now, parse a simple base64-encoded payload
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (err) {
    return null;
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
