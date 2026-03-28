// Unit tests for userRepository
jest.mock('../db/index', () => ({ query: jest.fn() }));

const { query } = require('../db/index');
const repo = require('../db/userRepository');

beforeEach(() => jest.clearAllMocks());

describe('getUserByWallet', () => {
  test('returns user when found', async () => {
    const user = { id: 1, wallet_address: 'GABC' };
    query.mockResolvedValue({ rows: [user] });
    expect(await repo.getUserByWallet('GABC')).toEqual(user);
  });

  test('returns null when not found', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.getUserByWallet('GABC')).toBeNull();
  });
});

describe('getUserById', () => {
  test('returns user when found', async () => {
    const user = { id: 1 };
    query.mockResolvedValue({ rows: [user] });
    expect(await repo.getUserById(1)).toEqual(user);
  });

  test('returns null when not found', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.getUserById(999)).toBeNull();
  });
});

describe('createUser', () => {
  test('creates user without referral', async () => {
    const user = { id: 1, wallet_address: 'GABC', referred_by: null };
    query.mockResolvedValue({ rows: [user] });
    const result = await repo.createUser({ walletAddress: 'GABC' });
    expect(result).toEqual(user);
    expect(query.mock.calls[0][1][1]).toBeNull(); // referredBy = null
  });

  test('creates user with referral', async () => {
    const user = { id: 2, wallet_address: 'GDEF', referred_by: 1 };
    query.mockResolvedValue({ rows: [user] });
    const result = await repo.createUser({ walletAddress: 'GDEF', referredBy: 1 });
    expect(result).toEqual(user);
    expect(query.mock.calls[0][1][1]).toBe(1);
  });
});

describe('markReferralBonusClaimed', () => {
  test('updates and returns user', async () => {
    const user = { id: 1, referral_bonus_claimed: true };
    query.mockResolvedValue({ rows: [user] });
    expect(await repo.markReferralBonusClaimed(1)).toEqual(user);
  });
});

describe('getReferredUsers', () => {
  test('returns list of referred users', async () => {
    const users = [{ id: 2 }, { id: 3 }];
    query.mockResolvedValue({ rows: users });
    expect(await repo.getReferredUsers(1)).toEqual(users);
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
    query.mockResolvedValue({ rows: [{ id: 1 }] });
    expect(await repo.hasReferralBonusBeenClaimed(1, 2)).toBe(true);
  });

  test('returns false when no row', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.hasReferralBonusBeenClaimed(1, 2)).toBe(false);
  });
});

describe('getUnprocessedReferrals', () => {
  test('returns unprocessed referrals', async () => {
    const rows = [{ id: 1, referred_by: 2 }];
    query.mockResolvedValue({ rows });
    expect(await repo.getUnprocessedReferrals(24)).toEqual(rows);
  });
});

describe('profile functions', () => {
  test('findById returns user', async () => {
    const user = { id: 1, first_name: 'John' };
    query.mockResolvedValue({ rows: [user] });
    expect(await repo.findById(1)).toEqual(user);
  });

  test('findById returns null when not found', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repo.findById(999)).toBeNull();
  });

  test('findByWalletAddress returns user', async () => {
    const user = { id: 1 };
    query.mockResolvedValue({ rows: [user] });
    expect(await repo.findByWalletAddress('GABC')).toEqual(user);
  });

  test('getPublicProfile returns limited fields', async () => {
    const profile = { id: 1, first_name: 'John' };
    query.mockResolvedValue({ rows: [profile] });
    expect(await repo.getPublicProfile(1)).toEqual(profile);
  });

  test('getPrivateProfile returns all fields', async () => {
    const profile = { id: 1, stellar_public_key: 'GABC' };
    query.mockResolvedValue({ rows: [profile] });
    expect(await repo.getPrivateProfile(1)).toEqual(profile);
  });

  test('update returns updated user', async () => {
    const updated = { id: 1, first_name: 'Jane' };
    query.mockResolvedValue({ rows: [updated] });
    expect(await repo.update(1, { first_name: 'Jane' })).toEqual(updated);
  });

  test('update with no valid fields calls findById', async () => {
    const user = { id: 1 };
    query.mockResolvedValue({ rows: [user] });
    // Pass an empty updates object — should call findById
    const result = await repo.update(1, {});
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
    query.mockResolvedValue({ rows: [{ role: 'user' }] });
    expect(await repo.isAdmin(1)).toBe(false);
  });
});
