const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db/index');
const { signAccessToken, signRefreshToken } = require('../services/tokenService');
const { validateRegisterDto } = require('../dtos/registerDto');
const { validateLoginDto } = require('../dtos/loginDto');

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Email already registered.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
        [normalizedEmail, passwordHash, firstName.trim(), lastName.trim()]
      );
    } catch (dbErr) {
      // Postgres unique violation
      if (dbErr.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'duplicate_email',
          message: 'An account with this email already exists',
        });
      }
      throw dbErr;
    }

    return res.status(201).json({ success: true, data: result.rows[0] });
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/AuthTokens' }
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Invalid credentials.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/login', async (req, res, next) => {
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

    const result = await query(
      `SELECT id, email, password_hash, first_name, last_name, role
       FROM users
       WHERE email = $1 AND is_deleted = FALSE`,
      [normalizedEmail]
    );

    const user = result.rows[0];

    // Use a constant-time compare even when user doesn't exist to prevent
    // timing-based user enumeration attacks.
    const DUMMY_HASH = '$2b$12$invalidhashpaddingtomatchbcryptlength000000000000000000000';
    const passwordMatch = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, DUMMY_HASH).then(() => false);

    if (!user || !passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'invalid_credentials',
        message: 'Email or password is incorrect',
      });
    }

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
