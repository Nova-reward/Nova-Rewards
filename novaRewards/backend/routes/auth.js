const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db/index');
const { signAccessToken, signRefreshToken } = require('../services/tokenService');
const { validateRegisterDto } = require('../dtos/registerDto');
const { validateLoginDto } = require('../dtos/loginDto');
const { checkIpBlock, recordFailedLogin } = require('../middleware/abuseDetection');

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
    }).catch((err) => console.error('[audit] register:', err.message));

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
    }).catch((err) => console.error('[audit] login:', err.message));

    const accessToken  = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

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

module.exports = router;
