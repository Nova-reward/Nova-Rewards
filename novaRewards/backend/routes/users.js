const router = require('express').Router();
const userRepository = require('../db/userRepository');
const { authenticateUser, requireOwnershipOrAdmin } = require('../middleware/authenticateUser');
const { validateUpdateUserDto } = require('../middleware/validateDto');

/**
 * GET /api/users/:id
 * Return user's public profile fields.
 * Private fields are gated behind ownership or admin role.
 * Requirements: 183.1
 */
router.get('/:id', authenticateUser, requireOwnershipOrAdmin, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUserId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Check if user exists
    const userExists = await userRepository.exists(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'User not found',
      });
    }

    // Return public profile for non-owners, private profile for owners/admins
    let profile;
    if (currentUserId === userId || isAdmin) {
      profile = await userRepository.getPrivateProfile(userId);
    } else {
      profile = await userRepository.getPublicProfile(userId);
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/users/:id
 * Accept partial updates (firstName, lastName, bio, stellarPublicKey).
 * Validates with UpdateUserDto.
 * Requirements: 183.2, 183.4
 */
router.patch('/:id', authenticateUser, requireOwnershipOrAdmin, validateUpdateUserDto, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    // Check if user exists
    const userExists = await userRepository.exists(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'User not found',
      });
    }

    // Map camelCase to snake_case for database
    const updates = {};
    if (req.body.firstName !== undefined) updates.first_name = req.body.firstName;
    if (req.body.lastName !== undefined) updates.last_name = req.body.lastName;
    if (req.body.bio !== undefined) updates.bio = req.body.bio;
    if (req.body.stellarPublicKey !== undefined) updates.stellar_public_key = req.body.stellarPublicKey;

    // Update user profile
    const updatedUser = await userRepository.update(userId, updates);

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/users/:id
 * Soft-delete by setting isDeleted = true and anonymising PII fields.
 * Requirements: 183.3
 */
router.delete('/:id', authenticateUser, requireOwnershipOrAdmin, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    // Check if user exists
    const userExists = await userRepository.exists(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'User not found',
      });
    }

    // Soft delete user
    const deleted = await userRepository.softDelete(userId);

    if (deleted) {
      res.json({
        success: true,
        message: 'User account deleted successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'delete_failed',
        message: 'Failed to delete user account',
      });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
