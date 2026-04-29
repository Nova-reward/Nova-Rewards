'use strict';

/**
 * Tests for comprehensive input validation DTOs.
 * Covers SQL injection, XSS, and field-level error format.
 * Closes #646
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
  validateRecordTransactionDto,
  validateTransactionHistoryQuery,
  validateCreateWebhookDto,
  validateUpdateWebhookDto,
  validateCreateAdminRewardDto,
  validateUpdateUserRoleDto,
  isStellarAddress,
  isSafeString,
} = require('../dtos/index');

const VALID_STELLAR = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const VALID_TX_HASH = 'a'.repeat(64);

describe('Input Validation DTOs — #646', () => {

  // ── Helpers ──────────────────────────────────────────────────────────────

  function expectValid(result) {
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  }

  function expectInvalid(result, field) {
    expect(result.valid).toBe(false);
    if (field) expect(result.errors[field]).toBeDefined();
  }

  // ── SQL injection / XSS vectors ──────────────────────────────────────────

  const SQL_PAYLOADS = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1; SELECT * FROM users",
    "admin'--",
  ];

  const XSS_PAYLOADS = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    "javascript:alert(1)",
  ];

  describe('SQL injection blocked in string fields', () => {
    SQL_PAYLOADS.forEach(payload => {
      it(`blocks: ${payload.slice(0, 30)}`, () => {
        const r = validateCreateCampaignDto({
          name: payload,
          rewardRate: 10,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        });
        expectInvalid(r, 'name');
      });
    });
  });

  describe('XSS blocked in string fields', () => {
    XSS_PAYLOADS.forEach(payload => {
      it(`blocks: ${payload.slice(0, 30)}`, () => {
        const r = validateCreateCampaignDto({
          name: payload,
          rewardRate: 10,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        });
        expectInvalid(r, 'name');
      });
    });
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  describe('validateLoginDto', () => {
    it('accepts valid credentials', () => {
      expectValid(validateLoginDto({ email: 'user@example.com', password: 'secret123' }));
    });
    it('rejects missing email', () => expectInvalid(validateLoginDto({ password: 'x' }), 'email'));
    it('rejects invalid email format', () => expectInvalid(validateLoginDto({ email: 'notanemail', password: 'x' }), 'email'));
    it('rejects oversized password', () => expectInvalid(validateLoginDto({ email: 'a@b.com', password: 'x'.repeat(129) }), 'password'));
  });

  describe('validateRegisterDto', () => {
    const valid = { email: 'a@b.com', password: 'password1', firstName: 'Alice', lastName: 'Smith' };
    it('accepts valid registration', () => expectValid(validateRegisterDto(valid)));
    it('rejects short password', () => expectInvalid(validateRegisterDto({ ...valid, password: 'short' }), 'password'));
    it('rejects long firstName', () => expectInvalid(validateRegisterDto({ ...valid, firstName: 'x'.repeat(101) }), 'firstName'));
    it('rejects SQL in firstName', () => expectInvalid(validateRegisterDto({ ...valid, firstName: "'; DROP TABLE--" }), 'firstName'));
  });

  // ── Campaigns ────────────────────────────────────────────────────────────

  describe('validateCreateCampaignDto', () => {
    const valid = { name: 'Summer Sale', rewardRate: 5, startDate: '2026-06-01', endDate: '2026-08-31' };
    it('accepts valid campaign', () => expectValid(validateCreateCampaignDto(valid)));
    it('rejects missing name', () => expectInvalid(validateCreateCampaignDto({ ...valid, name: '' }), 'name'));
    it('rejects negative rewardRate', () => expectInvalid(validateCreateCampaignDto({ ...valid, rewardRate: -1 }), 'rewardRate'));
    it('rejects endDate before startDate', () => expectInvalid(validateCreateCampaignDto({ ...valid, endDate: '2025-01-01' }), 'endDate'));
    it('rejects invalid date format', () => expectInvalid(validateCreateCampaignDto({ ...valid, startDate: 'not-a-date' }), 'startDate'));
  });

  describe('validateUpdateCampaignDto', () => {
    it('accepts partial update', () => expectValid(validateUpdateCampaignDto({ name: 'New Name' })));
    it('rejects empty body', () => expectInvalid(validateUpdateCampaignDto({}), 'name'));
    it('rejects XSS in name', () => expectInvalid(validateUpdateCampaignDto({ name: '<script>x</script>' }), 'name'));
  });

  // ── Rewards ──────────────────────────────────────────────────────────────

  describe('validateIssueRewardDto', () => {
    const valid = { idempotencyKey: 'key-123', walletAddress: VALID_STELLAR, amount: 50, campaignId: 1 };
    it('accepts valid payload', () => expectValid(validateIssueRewardDto(valid)));
    it('rejects invalid Stellar address', () => expectInvalid(validateIssueRewardDto({ ...valid, walletAddress: 'INVALID' }), 'walletAddress'));
    it('rejects zero amount', () => expectInvalid(validateIssueRewardDto({ ...valid, amount: 0 }), 'amount'));
    it('rejects non-integer campaignId', () => expectInvalid(validateIssueRewardDto({ ...valid, campaignId: 'abc' }), 'campaignId'));
  });

  // ── Redemptions ──────────────────────────────────────────────────────────

  describe('validateCreateRedemptionDto', () => {
    it('accepts valid redemption', () => expectValid(validateCreateRedemptionDto({ userId: 1, rewardId: 2 })));
    it('rejects string userId', () => expectInvalid(validateCreateRedemptionDto({ userId: 'abc', rewardId: 1 }), 'userId'));
    it('rejects negative rewardId', () => expectInvalid(validateCreateRedemptionDto({ userId: 1, rewardId: -5 }), 'rewardId'));
  });

  // ── Users ────────────────────────────────────────────────────────────────

  describe('validateCreateUserDto', () => {
    it('accepts valid wallet', () => expectValid(validateCreateUserDto({ walletAddress: VALID_STELLAR })));
    it('rejects invalid wallet', () => expectInvalid(validateCreateUserDto({ walletAddress: 'bad' }), 'walletAddress'));
  });

  describe('validateUpdateUserDto', () => {
    it('accepts partial update', () => expectValid(validateUpdateUserDto({ firstName: 'Bob' })));
    it('rejects long bio', () => expectInvalid(validateUpdateUserDto({ bio: 'x'.repeat(1001) }), 'bio'));
    it('rejects invalid stellarPublicKey', () => expectInvalid(validateUpdateUserDto({ stellarPublicKey: 'NOTVALID' }), 'stellarPublicKey'));
  });

  // ── Wallets ──────────────────────────────────────────────────────────────

  describe('validateVerifyWalletDto', () => {
    it('accepts valid public key', () => expectValid(validateVerifyWalletDto({ publicKey: VALID_STELLAR })));
    it('rejects invalid wallet type', () => expectInvalid(validateVerifyWalletDto({ publicKey: VALID_STELLAR, walletType: 'unknown' }), 'walletType'));
  });

  // ── Transactions ─────────────────────────────────────────────────────────

  describe('validateRecordTransactionDto', () => {
    const valid = { txHash: VALID_TX_HASH, txType: 'distribution' };
    it('accepts valid transaction', () => expectValid(validateRecordTransactionDto(valid)));
    it('rejects non-hex txHash', () => expectInvalid(validateRecordTransactionDto({ ...valid, txHash: 'not-hex' }), 'txHash'));
    it('rejects invalid txType', () => expectInvalid(validateRecordTransactionDto({ ...valid, txType: 'hack' }), 'txType'));
    it('rejects invalid fromWallet', () => expectInvalid(validateRecordTransactionDto({ ...valid, fromWallet: 'BAD' }), 'fromWallet'));
  });

  describe('validateTransactionHistoryQuery', () => {
    it('accepts empty query', () => expectValid(validateTransactionHistoryQuery({})));
    it('rejects page=0', () => expectInvalid(validateTransactionHistoryQuery({ page: '0' }), 'page'));
    it('rejects limit=200', () => expectInvalid(validateTransactionHistoryQuery({ limit: '200' }), 'limit'));
    it('rejects invalid status', () => expectInvalid(validateTransactionHistoryQuery({ status: 'hacked' }), 'status'));
  });

  // ── Webhooks ─────────────────────────────────────────────────────────────

  describe('validateCreateWebhookDto', () => {
    const valid = { url: 'https://example.com/hook', events: ['reward.issued'] };
    it('accepts valid webhook', () => expectValid(validateCreateWebhookDto(valid)));
    it('rejects http url', () => expectInvalid(validateCreateWebhookDto({ ...valid, url: 'http://example.com' }), 'url'));
    it('rejects unknown event', () => expectInvalid(validateCreateWebhookDto({ ...valid, events: ['unknown.event'] }), 'events'));
    it('rejects empty events array', () => expectInvalid(validateCreateWebhookDto({ ...valid, events: [] }), 'events'));
  });

  // ── Admin ────────────────────────────────────────────────────────────────

  describe('validateCreateAdminRewardDto', () => {
    const valid = { name: 'Coffee', pointsCost: 100 };
    it('accepts valid reward', () => expectValid(validateCreateAdminRewardDto(valid)));
    it('rejects missing name', () => expectInvalid(validateCreateAdminRewardDto({ pointsCost: 100 }), 'name'));
    it('rejects zero pointsCost', () => expectInvalid(validateCreateAdminRewardDto({ ...valid, pointsCost: 0 }), 'pointsCost'));
    it('rejects XSS in name', () => expectInvalid(validateCreateAdminRewardDto({ ...valid, name: '<img onerror=x>' }), 'name'));
  });

  describe('validateUpdateUserRoleDto', () => {
    it('accepts valid role', () => expectValid(validateUpdateUserRoleDto({ role: 'admin' })));
    it('rejects unknown role', () => expectInvalid(validateUpdateUserRoleDto({ role: 'superuser' }), 'role'));
  });

  // ── Error response format ─────────────────────────────────────────────────

  describe('Error response format', () => {
    it('returns field-level errors as arrays', () => {
      const r = validateLoginDto({ email: 'bad', password: '' });
      expect(r.valid).toBe(false);
      expect(typeof r.errors).toBe('object');
      Object.values(r.errors).forEach(msgs => expect(Array.isArray(msgs)).toBe(true));
    });
  });

  // ── isSafeString helper ───────────────────────────────────────────────────

  describe('isSafeString', () => {
    it('allows normal text', () => expect(isSafeString('Hello World')).toBe(true));
    it('blocks single quote', () => expect(isSafeString("O'Brien")).toBe(false));
    it('blocks double quote', () => expect(isSafeString('"quoted"')).toBe(false));
    it('blocks semicolon', () => expect(isSafeString('a; b')).toBe(false));
    it('blocks angle brackets', () => expect(isSafeString('<tag>')).toBe(false));
  });
});
