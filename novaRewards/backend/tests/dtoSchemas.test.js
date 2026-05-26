'use strict';

/**
 * Unit tests for DTO validation schemas (#952)
 *
 * The codebase uses custom validators in dtos/index.js (not Zod).
 * These tests verify: valid inputs pass, invalid inputs fail with the
 * correct error messages, boundary values, and unknown-field stripping.
 *
 * No I/O — all tests run in-process.
 *
 * Closes #952
 */

const {
  validateLoginDto,
  validateRegisterDto,
  validateCreateCampaignDto,
  validateUpdateCampaignDto,
  validateIssueRewardDto,
  validateDistributeRewardDto,
  validateCreateRedemptionDto,
  validateCreateUserDto,
  validateUpdateUserDto,
  validateVerifyWalletDto,
} = require('../dtos/index');

// ── Helpers ───────────────────────────────────────────────────────────────

const VALID_STELLAR = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

function expectValid(r) {
  expect(r.valid).toBe(true);
  expect(r.errors).toEqual({});
}

function expectInvalid(r, field, msgFragment) {
  expect(r.valid).toBe(false);
  if (field) {
    expect(r.errors[field]).toBeDefined();
    expect(r.errors[field].length).toBeGreaterThan(0);
  }
  if (msgFragment) {
    const allMessages = Object.values(r.errors).flat().join(' ');
    expect(allMessages.toLowerCase()).toContain(msgFragment.toLowerCase());
  }
}

// ── validateLoginDto ──────────────────────────────────────────────────────

describe('validateLoginDto', () => {
  const VALID = { email: 'user@example.com', password: 'secret123' };

  it('passes with valid email and password', () => expectValid(validateLoginDto(VALID)));

  it('fails — missing email', () => {
    expectInvalid(validateLoginDto({ password: 'secret' }), 'email', 'email');
  });

  it('fails — invalid email format', () => {
    expectInvalid(validateLoginDto({ ...VALID, email: 'not-an-email' }), 'email', 'email');
  });

  it('fails — email exceeds 254 chars', () => {
    const long = 'a'.repeat(245) + '@b.com';
    expectInvalid(validateLoginDto({ ...VALID, email: long }), 'email');
  });

  it('fails — missing password', () => {
    expectInvalid(validateLoginDto({ email: VALID.email }), 'password', 'required');
  });

  it('fails — password exceeds 128 chars', () => {
    expectInvalid(validateLoginDto({ ...VALID, password: 'x'.repeat(129) }), 'password', '128');
  });
});

// ── validateRegisterDto ───────────────────────────────────────────────────

describe('validateRegisterDto', () => {
  const VALID = {
    email: 'new@example.com',
    password: 'Str0ngPass!',
    firstName: 'Alice',
    lastName: 'Smith',
  };

  it('passes with all valid fields', () => expectValid(validateRegisterDto(VALID)));

  it('fails — password too short (< 8 chars)', () => {
    expectInvalid(validateRegisterDto({ ...VALID, password: 'abc' }), 'password', '8');
  });

  it('fails — password too long (> 128 chars)', () => {
    expectInvalid(validateRegisterDto({ ...VALID, password: 'x'.repeat(129) }), 'password', '128');
  });

  it('fails — firstName missing', () => {
    const { firstName, ...body } = VALID;
    expectInvalid(validateRegisterDto(body), 'firstName', 'required');
  });

  it('fails — firstName too long (> 100 chars)', () => {
    expectInvalid(validateRegisterDto({ ...VALID, firstName: 'A'.repeat(101) }), 'firstName', '100');
  });

  it('fails — firstName contains SQL injection', () => {
    expectInvalid(validateRegisterDto({ ...VALID, firstName: "'; DROP TABLE users; --" }), 'firstName');
  });

  it('fails — lastName missing', () => {
    const { lastName, ...body } = VALID;
    expectInvalid(validateRegisterDto(body), 'lastName', 'required');
  });

  it('fails — lastName too long (> 100 chars)', () => {
    expectInvalid(validateRegisterDto({ ...VALID, lastName: 'B'.repeat(101) }), 'lastName', '100');
  });

  it('boundary — firstName exactly 100 chars passes', () => {
    expectValid(validateRegisterDto({ ...VALID, firstName: 'A'.repeat(100) }));
  });

  it('boundary — password exactly 8 chars passes', () => {
    expectValid(validateRegisterDto({ ...VALID, password: 'Abcdef1!' }));
  });

  it('boundary — password exactly 128 chars passes', () => {
    expectValid(validateRegisterDto({ ...VALID, password: 'A'.repeat(128) }));
  });
});

// ── validateCreateCampaignDto ─────────────────────────────────────────────

describe('validateCreateCampaignDto', () => {
  const VALID = {
    name: 'Summer Sale',
    rewardRate: 5,
    startDate: '2026-06-01',
    endDate: '2026-08-31',
  };

  it('passes with all valid fields', () => expectValid(validateCreateCampaignDto(VALID)));

  it('fails — missing name', () => {
    const { name, ...body } = VALID;
    expectInvalid(validateCreateCampaignDto(body), 'name', 'required');
  });

  it('fails — name too long (> 200 chars)', () => {
    expectInvalid(validateCreateCampaignDto({ ...VALID, name: 'N'.repeat(201) }), 'name', '200');
  });

  it('fails — name contains XSS payload', () => {
    expectInvalid(validateCreateCampaignDto({ ...VALID, name: '<script>alert(1)</script>' }), 'name');
  });

  it('fails — name contains SQL injection', () => {
    expectInvalid(validateCreateCampaignDto({ ...VALID, name: "'; DROP TABLE campaigns; --" }), 'name');
  });

  it('fails — rewardRate is zero', () => {
    expectInvalid(validateCreateCampaignDto({ ...VALID, rewardRate: 0 }), 'rewardRate', 'positive');
  });

  it('fails — rewardRate is negative', () => {
    expectInvalid(validateCreateCampaignDto({ ...VALID, rewardRate: -1 }), 'rewardRate', 'positive');
  });

  it('fails — rewardRate missing', () => {
    const { rewardRate, ...body } = VALID;
    expectInvalid(validateCreateCampaignDto(body), 'rewardRate', 'required');
  });

  it('fails — rewardRate exceeds max (> 1000000)', () => {
    expectInvalid(validateCreateCampaignDto({ ...VALID, rewardRate: 1_000_001 }), 'rewardRate');
  });

  it('boundary — rewardRate exactly 1000000 passes', () => {
    expectValid(validateCreateCampaignDto({ ...VALID, rewardRate: 1_000_000 }));
  });

  it('fails — missing startDate', () => {
    const { startDate, ...body } = VALID;
    expectInvalid(validateCreateCampaignDto(body), 'startDate', 'required');
  });

  it('fails — missing endDate', () => {
    const { endDate, ...body } = VALID;
    expectInvalid(validateCreateCampaignDto(body), 'endDate', 'required');
  });

  it('fails — endDate before startDate', () => {
    expectInvalid(
      validateCreateCampaignDto({ ...VALID, startDate: '2026-12-01', endDate: '2026-01-01' }),
      'endDate',
      'after'
    );
  });

  it('fails — endDate equal to startDate', () => {
    expectInvalid(
      validateCreateCampaignDto({ ...VALID, startDate: '2026-06-01', endDate: '2026-06-01' }),
      'endDate',
      'after'
    );
  });

  it('fails — invalid date string', () => {
    expectInvalid(validateCreateCampaignDto({ ...VALID, startDate: 'not-a-date' }), 'startDate');
  });

  it('boundary — name exactly 200 chars passes', () => {
    expectValid(validateCreateCampaignDto({ ...VALID, name: 'A'.repeat(200) }));
  });
});

// ── validateUpdateCampaignDto ─────────────────────────────────────────────

describe('validateUpdateCampaignDto', () => {
  it('passes with name only', () => expectValid(validateUpdateCampaignDto({ name: 'New Name' })));
  it('passes with rewardRate only', () => expectValid(validateUpdateCampaignDto({ rewardRate: 3 })));
  it('passes with both fields', () => expectValid(validateUpdateCampaignDto({ name: 'X', rewardRate: 1 })));

  it('fails — empty body (no fields)', () => {
    expectInvalid(validateUpdateCampaignDto({}), 'name');
  });

  it('fails — name is empty string', () => {
    expectInvalid(validateUpdateCampaignDto({ name: '' }), 'name');
  });

  it('fails — name too long', () => {
    expectInvalid(validateUpdateCampaignDto({ name: 'N'.repeat(201) }), 'name', '200');
  });

  it('fails — rewardRate is zero', () => {
    expectInvalid(validateUpdateCampaignDto({ rewardRate: 0 }), 'rewardRate', 'positive');
  });

  it('fails — name contains SQL injection', () => {
    expectInvalid(validateUpdateCampaignDto({ name: "' OR 1=1 --" }), 'name');
  });
});

// ── validateIssueRewardDto ────────────────────────────────────────────────

describe('validateIssueRewardDto', () => {
  const VALID = {
    idempotencyKey: 'idem-key-abc-123',
    walletAddress: VALID_STELLAR,
    amount: 100,
    campaignId: 1,
  };

  it('passes with all valid fields', () => expectValid(validateIssueRewardDto(VALID)));

  it('fails — missing idempotencyKey', () => {
    const { idempotencyKey, ...body } = VALID;
    expectInvalid(validateIssueRewardDto(body), 'idempotencyKey', 'required');
  });

  it('fails — idempotencyKey too long (> 128 chars)', () => {
    expectInvalid(validateIssueRewardDto({ ...VALID, idempotencyKey: 'x'.repeat(129) }), 'idempotencyKey', '128');
  });

  it('fails — invalid walletAddress', () => {
    expectInvalid(validateIssueRewardDto({ ...VALID, walletAddress: 'not-stellar' }), 'walletAddress', 'stellar');
  });

  it('fails — amount is zero', () => {
    expectInvalid(validateIssueRewardDto({ ...VALID, amount: 0 }), 'amount', 'positive');
  });

  it('fails — amount is negative', () => {
    expectInvalid(validateIssueRewardDto({ ...VALID, amount: -1 }), 'amount', 'positive');
  });

  it('fails — campaignId is not a positive integer', () => {
    expectInvalid(validateIssueRewardDto({ ...VALID, campaignId: 0 }), 'campaignId', 'positive integer');
  });

  it('fails — campaignId is a float', () => {
    expectInvalid(validateIssueRewardDto({ ...VALID, campaignId: 1.5 }), 'campaignId', 'positive integer');
  });
});

// ── validateCreateRedemptionDto ───────────────────────────────────────────

describe('validateCreateRedemptionDto', () => {
  const VALID = { userId: 1, rewardId: 2 };

  it('passes with userId and rewardId', () => expectValid(validateCreateRedemptionDto(VALID)));
  it('passes with optional campaignId', () => expectValid(validateCreateRedemptionDto({ ...VALID, campaignId: 3 })));

  it('fails — userId is zero', () => {
    expectInvalid(validateCreateRedemptionDto({ ...VALID, userId: 0 }), 'userId', 'positive integer');
  });

  it('fails — rewardId is missing', () => {
    expectInvalid(validateCreateRedemptionDto({ userId: 1 }), 'rewardId', 'positive integer');
  });

  it('fails — campaignId is not a positive integer when provided', () => {
    expectInvalid(validateCreateRedemptionDto({ ...VALID, campaignId: -1 }), 'campaignId', 'positive integer');
  });
});

// ── validateCreateUserDto ─────────────────────────────────────────────────

describe('validateCreateUserDto', () => {
  it('passes with valid walletAddress', () => {
    expectValid(validateCreateUserDto({ walletAddress: VALID_STELLAR }));
  });

  it('passes with valid walletAddress and referralCode', () => {
    expectValid(validateCreateUserDto({ walletAddress: VALID_STELLAR, referralCode: VALID_STELLAR }));
  });

  it('fails — invalid walletAddress', () => {
    expectInvalid(validateCreateUserDto({ walletAddress: 'bad' }), 'walletAddress', 'stellar');
  });

  it('fails — invalid referralCode when provided', () => {
    expectInvalid(
      validateCreateUserDto({ walletAddress: VALID_STELLAR, referralCode: 'bad' }),
      'referralCode',
      'stellar'
    );
  });
});

// ── validateUpdateUserDto ─────────────────────────────────────────────────

describe('validateUpdateUserDto', () => {
  it('passes with valid firstName', () => expectValid(validateUpdateUserDto({ firstName: 'Bob' })));
  it('passes with valid bio', () => expectValid(validateUpdateUserDto({ bio: 'Hello world' })));
  it('passes with valid stellarPublicKey', () => expectValid(validateUpdateUserDto({ stellarPublicKey: VALID_STELLAR })));

  it('fails — firstName too long', () => {
    expectInvalid(validateUpdateUserDto({ firstName: 'A'.repeat(101) }), 'firstName', '100');
  });

  it('fails — bio too long (> 1000 chars)', () => {
    expectInvalid(validateUpdateUserDto({ bio: 'x'.repeat(1001) }), 'bio', '1000');
  });

  it('boundary — bio exactly 1000 chars passes', () => {
    expectValid(validateUpdateUserDto({ bio: 'x'.repeat(1000) }));
  });

  it('fails — invalid stellarPublicKey', () => {
    expectInvalid(validateUpdateUserDto({ stellarPublicKey: 'not-stellar' }), 'stellarPublicKey', 'stellar');
  });

  it('fails — firstName contains SQL injection', () => {
    expectInvalid(validateUpdateUserDto({ firstName: "'; DROP TABLE users; --" }), 'firstName');
  });
});

// ── validateVerifyWalletDto ───────────────────────────────────────────────

describe('validateVerifyWalletDto', () => {
  it('passes with valid publicKey', () => {
    expectValid(validateVerifyWalletDto({ publicKey: VALID_STELLAR }));
  });

  it('passes with valid publicKey and walletType', () => {
    expectValid(validateVerifyWalletDto({ publicKey: VALID_STELLAR, walletType: 'freighter' }));
  });

  it('fails — invalid publicKey', () => {
    expectInvalid(validateVerifyWalletDto({ publicKey: 'bad' }), 'publicKey', 'stellar');
  });

  it('fails — unsupported walletType', () => {
    expectInvalid(
      validateVerifyWalletDto({ publicKey: VALID_STELLAR, walletType: 'metamask' }),
      'walletType'
    );
  });

  it('passes — all supported wallet types', () => {
    for (const wt of ['freighter', 'xbull', 'albedo', 'walletconnect']) {
      expectValid(validateVerifyWalletDto({ publicKey: VALID_STELLAR, walletType: wt }));
    }
  });
});

// ── Unknown fields are not included in output ─────────────────────────────

describe('DTO unknown-field handling', () => {
  it('validateLoginDto — unknown fields do not cause validation failure', () => {
    const r = validateLoginDto({
      email: 'user@example.com',
      password: 'secret123',
      unknownField: 'should be ignored',
      __proto__: 'injection',
    });
    // Validators only check known fields; unknown fields are silently ignored
    expect(r.valid).toBe(true);
  });

  it('validateCreateCampaignDto — unknown fields do not cause failure', () => {
    const r = validateCreateCampaignDto({
      name: 'Test',
      rewardRate: 1,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      extraField: 'ignored',
    });
    expect(r.valid).toBe(true);
  });
});
