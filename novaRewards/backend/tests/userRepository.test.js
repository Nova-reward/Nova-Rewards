// Unit tests for userRepository
jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const repo = require('../db/userRepository');
const { UserFactory, STELLAR_ADDRESSES } = require('./fixtures');

beforeEach(() => jest.clearAllMocks());

describe('getUserByWallet', () => {
  test('returns user when found', async () => {
    const user = UserFactory.build();
    query.mockResolvedValue({ rows: [user] });
    expect(await repo.getUserByWallet(user.wallet_address)).toEqual(user);
  });

  test('returns null when not found', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.getUserByWallet(STELLAR_ADDRESSES[0])).toBeNull();
  });
});

describe('getUserById', () => {
  test('returns user when found', async () => {
    const user = UserFactory.build();
    query.mockResolvedValue({ rows: [user] });
    expect(await repo.getUserById(user.id)).toEqual(user);
  });

  test('returns null when not found', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.getUserById(999)).toBeNull();
  });
});

describe('createUser', () => {
  test('creates user without referral', async () => {
    const user = UserFactory.build({ referred_by: null });
    query.mockResolvedValue({ rows: [user] });
    const result = await repo.createUser({ walletAddress: user.wallet_address });
    expect(result).toEqual(user);
    expect(query.mock.calls[0][1][1]).toBeNull(); // referredBy = null
  });

  test('creates user with referral', async () => {
    const referrer = UserFactory.build();
    const user = UserFactory.build({ referred_by: referrer.id });
    query.mockResolvedValue({ rows: [user] });
    const result = await repo.createUser({ walletAddress: user.wallet_address, referredBy: referrer.id });
    expect(result).toEqual(user);
    expect(query.mock.calls[0][1][1]).toBe(referrer.id);
  });
});

describe('markReferralBonusClaimed', () => {
  test('updates and returns user', async () => {
    const user = UserFactory.build({ referral_bonus_claimed: true });
    query.mockResolvedValue({ rows: [user] });
    expect(await repo.markReferralBonusClaimed(user.id)).toEqual(user);
  });
});

describe('getReferredUsers', () => {
  test('returns list of referred users', async () => {
    const referrer = UserFactory.build();
    const referred = UserFactory.buildList(2, { referred_by: referrer.id });
    query.mockResolvedValue({ rows: referred });
    expect(await repo.getReferredUsers(referrer.id)).toEqual(referred);
  });
});

describe('getReferralPointsEarned', () => {
  test('returns total as string', async () => {
    query.mockResolvedValue({ rows: [{ total: '200' }] });
    expect(await repo.getReferralPointsEarned(1)).toBe('200');
  });
});

describe('hasReferralBonusBeenClaimed', () => {
  test('returns true when row exists', async () => {
    const user = UserFactory.build();
    query.mockResolvedValue({ rows: [{ id: user.id }] });
    expect(await repo.hasReferralBonusBeenClaimed(1, 2)).toBe(true);
  });

  test('returns false when no row', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.hasReferralBonusBeenClaimed(1, 2)).toBe(false);
  });
});

describe('getUnprocessedReferrals', () => {
  test('returns unprocessed referrals', async () => {
    const referrer = UserFactory.build();
    const rows = [UserFactory.build({ referred_by: referrer.id })];
    query.mockResolvedValue({ rows });
    expect(await repo.getUnprocessedReferrals(24)).toEqual(rows);
  });
});

describe('profile functions', () => {
  test('findById returns user', async () => {
    const user = UserFactory.build();
    query.mockResolvedValue({ rows: [user] });
    expect(await repo.findById(user.id)).toEqual(user);
  });

  test('findById returns null when not found', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.findById(999)).toBeNull();
  });

  test('findByWalletAddress returns user', async () => {
    const user = UserFactory.build();
    query.mockResolvedValue({ rows: [user] });
    expect(await repo.findByWalletAddress(user.wallet_address)).toEqual(user);
  });

  test('getPublicProfile returns limited fields', async () => {
    const user = UserFactory.build();
    const profile = { id: user.id, first_name: user.first_name };
    query.mockResolvedValue({ rows: [profile] });
    expect(await repo.getPublicProfile(user.id)).toEqual(profile);
  });

  test('getPrivateProfile returns all fields', async () => {
    const user = UserFactory.build();
    query.mockResolvedValue({ rows: [user] });
    expect(await repo.getPrivateProfile(user.id)).toEqual(user);
  });

  test('update returns updated user', async () => {
    const user = UserFactory.build();
    const updated = { ...user, first_name: 'Jane' };
    query.mockResolvedValue({ rows: [updated] });
    expect(await repo.update(user.id, { first_name: 'Jane' })).toEqual(updated);
  });

  test('update with no valid fields calls findById', async () => {
    const user = UserFactory.build();
    query.mockResolvedValue({ rows: [user] });
    const result = await repo.update(user.id, {});
    expect(result).toEqual(user);
  });

  test('softDelete returns true on success', async () => {
    query.mockResolvedValue({ rowCount: 1 });
    expect(await repo.softDelete(1)).toBe(true);
  });

  test('softDelete returns false when user not found', async () => {
    query.mockResolvedValue({ rowCount: 0 });
    expect(await repo.softDelete(999)).toBe(false);
  });

  test('exists returns true when user found', async () => {
    query.mockResolvedValue({ rows: [{ 1: 1 }] });
    expect(await repo.exists(1)).toBe(true);
  });

  test('exists returns false when not found', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.exists(999)).toBe(false);
  });

  test('isAdmin returns true for admin role', async () => {
    query.mockResolvedValue({ rows: [{ role: 'admin' }] });
    expect(await repo.isAdmin(1)).toBe(true);
  });

  test('isAdmin returns false for non-admin', async () => {
    const user = UserFactory.build({ role: 'user' });
    query.mockResolvedValue({ rows: [{ role: user.role }] });
    expect(await repo.isAdmin(user.id)).toBe(false);
  });
});
