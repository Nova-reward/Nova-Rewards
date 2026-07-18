const logger = require('./lib/logger');
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db/index');
const {
  signAccessToken,
  signRefreshToken,
  storeRefreshJti,
  verifyToken,
  revokeToken,
  consumeRefreshJti,
  revokeAllUserRefreshJtis,
  issueDbRefreshToken,
  rotateDbRefreshToken,
  revokeAllDbRefreshTokens,
} = require('../services/tokenService');
const { validateRegisterDto } = require('../dtos/registerDto');
const { validateLoginDto } = require('../dtos/loginDto');
const { checkIpBlock, recordFailedLogin } = require('../middleware/abuseDetection');
const { logAudit } = require('../db/auditLogRepository');
const { authenticateUser } = require('../middleware/authenticateUser');

const SALT_ROUNDS = 12;

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "S3cur3P@ss!"
 *               firstName:
 *                 type: string
 *                 example: Alice
 *               lastName:
 *                 type: string
 *                 example: Smith
 *     responses:
 *       201:
 *         description: User created.
 *       400:
 *         description: Validation error.
 *       409:
 *         description: Email already registered.
 */
router.post('/register', async (req, res, next) => {
  try {
    const validation = validateRegisterDto(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Validation failed',
        details: validation.errors,
      });
    }

    const { email, password, firstName, lastName } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    let result;
    try {
      result = await query(
        `INSERT INTO users (email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, first_name, last_name, role, created_at`,
        [encryptedEmail, passwordHash, firstName.trim(), lastName.trim()]
      );
    } catch (dbErr) {
      if (dbErr.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'duplicate_email',
          message: 'An account with this email already exists',
        });
      }
      throw dbErr;
    }

    const newUser = result.rows[0];

    // Explicit audit log for registration
    logAudit({
      entityType: 'user',
      entityId: newUser.id,
      action: 'register',
      performedBy: newUser.id,
      actorType: 'user',
      details: { email: normalizedEmail },
      source: 'POST /api/auth/register',
    }).catch((err) => logger.error('[audit] register:', err.message));

    return res.status(201).json({ success: true, data: newUser });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate and obtain JWT tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *               password:
 *                 type: string
 *                 example: "S3cur3P@ss!"
 *     responses:
 *       200:
 *         description: Login successful.
 *       400:
 *         description: Validation error.
 *       401:
 *         description: Invalid credentials.
 */
router.post('/login', checkIpBlock, async (req, res, next) => {
  try {
    const validation = validateLoginDto(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Validation failed',
        details: validation.errors,
      });
    }

    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const encryptedEmail  = encrypt(normalizedEmail);

    const result = await query(
      `SELECT id, email, password_hash, first_name, last_name, role
       FROM users
       WHERE email = $1 AND is_deleted = FALSE`,
      [encryptedEmail]
    );

    const user = result.rows[0];
    // Decrypt email for the response
    if (user && user.email) user.email = decrypt(user.email);

    // Constant-time compare to prevent timing-based user enumeration
    const DUMMY_HASH = '$2b$12$invalidhashpaddingtomatchbcryptlength000000000000000000000';
    const passwordMatch = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, DUMMY_HASH).then(() => false);

    if (!user || !passwordMatch) {
      await recordFailedLogin(req);
      return res.status(401).json({
        success: false,
        error: 'invalid_credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Log successful login
    logAudit({
      entityType: 'auth',
      entityId: user.id,
      action: 'login',
      performedBy: user.id,
      actorType: user.role === 'admin' ? 'admin' : 'user',
      details: { email: normalizedEmail },
      source: 'POST /api/auth/login',
    }).catch((err) => logger.error('[audit] login:', err.message));

    const accessToken  = signAccessToken(user);
    const { token: refreshToken } = await issueDbRefreshToken(user);

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token and issue new access + refresh tokens
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Refresh token required' });
    }

    // Verify JWT signature and expiry
    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Invalid or expired refresh token' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Invalid token type' });
    }

    // Look up user by wallet address from JWT sub
    const result = await query(
      `SELECT id, wallet_address, role FROM users WHERE wallet_address = $1 AND is_deleted = FALSE`,
      [decoded.sub]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'User not found' });
    }

    // Rotate: bcrypt-compare against DB, detect reuse, issue new token
    let newTokenData;
    try {
      newTokenData = await rotateDbRefreshToken(refreshToken, user.id);
    } catch (reuseErr) {
      if (reuseErr.code === 'token_reuse') {
        // Entire family already revoked — also revoke all DB tokens for safety
        await revokeAllDbRefreshTokens(user.id);
        return res.status(401).json({ success: false, error: 'token_reuse', message: 'Refresh token reuse detected. All sessions revoked.' });
      }
      throw reuseErr;
    }

    if (!newTokenData) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Refresh token not found or expired' });
    }

    const accessToken = signAccessToken(user);
    return res.json({ success: true, data: { accessToken, refreshToken: newTokenData.token } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke access token and refresh token (add to blocklist)
 *     security:
 *       - bearerAuth: []
 */
router.post('/logout', authenticateUser, async (req, res, next) => {
  try {
    // Revoke access token in Redis blocklist
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = verifyToken(authHeader.substring(7));
        if (decoded.jti) await revokeToken(decoded.jti, decoded.exp);
      } catch { /* already expired */ }
    }

    // Revoke the presented refresh token in DB
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      try {
        const decoded = verifyToken(refreshToken);
        if (decoded.sub === req.user.wallet_address) {
          await rotateDbRefreshToken(refreshToken, req.user.id).catch(() => {});
          // Immediately revoke the newly-issued replacement (if any) — we just want to invalidate
          await revokeAllDbRefreshTokens(req.user.id);
        }
      } catch { /* already expired or invalid */ }
    }

    return res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke all refresh tokens for the authenticated user
 *     security:
 *       - bearerAuth: []
 */
router.post('/logout-all', authenticateUser, async (req, res, next) => {
  try {
    // Revoke the current access token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = verifyToken(authHeader.substring(7));
        if (decoded.jti) await revokeToken(decoded.jti, decoded.exp);
      } catch { /* already expired */ }
    }

    // Revoke all DB refresh tokens + Redis JTIs for this user
    await Promise.all([
      revokeAllDbRefreshTokens(req.user.id),
      revokeAllUserRefreshJtis(req.user.wallet_address),
    ]);

    return res.json({ success: true, message: 'All sessions revoked' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
