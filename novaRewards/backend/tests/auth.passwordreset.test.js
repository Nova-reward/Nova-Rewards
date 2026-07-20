'use strict';

/**
 * Unit tests for passwordResetService
 * Closes #348
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock DB ──────────────────────────────────────────────────────────────────
vi.mock('../../db/index', () => ({ query: vi.fn() }));

const { query } = await import('../../db/index');
const {
  createResetToken,
  validateResetToken,
  consumeResetToken,
} = await import('../../services/passwordResetService');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(overrides = {}) {
  return {
    id:         1,
    user_id:    42,
    token_hash: '$2b$10$placeholder',
    ...overrides,
  };
}

// ── createResetToken ──────────────────────────────────────────────────────────

describe('createResetToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalidates existing tokens and inserts a new one', async () => {
    query.mockResolvedValue({ rows: [] });

    const token = await createResetToken(42);

    expect(query).toHaveBeenCalledTimes(2);
    // First call: invalidate existing tokens
    expect(query.mock.calls[0][0]).toMatch(/UPDATE password_reset_tokens/i);
    expect(query.mock.calls[0][1]).toContain(42);
    // Second call: insert new token
    expect(query.mock.calls[1][0]).toMatch(/INSERT INTO password_reset_tokens/i);
    expect(query.mock.calls[1][1][0]).toBe(42);
    // Raw token is 64 hex chars
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── validateResetToken ────────────────────────────────────────────────────────

describe('validateResetToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns tokenId and userId when token matches', async () => {
    const rawToken = 'a'.repeat(64);
    // Use a real bcrypt hash for 'a'.repeat(64) would be slow in tests;
    // instead mock bcrypt via a spy
    const bcrypt = await import('bcryptjs');
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    query.mockResolvedValue({ rows: [makeRow({ id: 7, user_id: 42 })] });

    const result = await validateResetToken(rawToken);
    expect(result).toEqual({ tokenId: 7, userId: 42 });
  });

  it('throws invalid_token when no rows match', async () => {
    const bcrypt = await import('bcryptjs');
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    query.mockResolvedValue({ rows: [makeRow()] });

    await expect(validateResetToken('bad_token')).rejects.toMatchObject({
      code: 'invalid_token',
    });
  });

  it('throws invalid_token when no rows returned', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(validateResetToken('x'.repeat(64))).rejects.toMatchObject({
      code: 'invalid_token',
    });
  });
});

// ── consumeResetToken ─────────────────────────────────────────────────────────

describe('consumeResetToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates used_at for the given tokenId', async () => {
    query.mockResolvedValue({ rows: [] });

    await consumeResetToken(7);

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE password_reset_tokens SET used_at/i),
      [7]
    );
  });
});
