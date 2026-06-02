/**
 * Factory smoke tests — verifies all factories produce valid data
 * and that traits work correctly.
 */

const {
  merchantFactory,
  campaignFactory,
  userFactory,
  rewardIssuanceFactory,
} = require('./fixtures/factories');

describe('merchantFactory', () => {
  it('builds a valid merchant', () => {
    const m = merchantFactory.build();
    expect(m.id).toBeGreaterThan(0);
    expect(m.name).toBeTruthy();
    expect(m.wallet_address).toMatch(/^G[A-Z0-9]{55}$/);
    expect(m.api_key).toHaveLength(64);
  });

  it('builds a list', () => {
    const merchants = merchantFactory.buildList(3);
    expect(merchants).toHaveLength(3);
    const ids = merchants.map((m) => m.id);
    expect(new Set(ids).size).toBe(3); // unique ids
  });
});

describe('campaignFactory', () => {
  it('builds an active campaign', () => {
    const c = campaignFactory.build();
    expect(c.is_active).toBe(true);
    expect(c.reward_rate).toBeGreaterThan(0);
  });

  it('expired trait: end_date in the past and is_active false', () => {
    const c = campaignFactory.build(campaignFactory.params.expired());
    expect(new Date(c.end_date) < new Date()).toBe(true);
    expect(c.is_active).toBe(false);
  });

  it('depletedBudget trait: very low reward_rate', () => {
    const c = campaignFactory.build(campaignFactory.params.depletedBudget());
    expect(c.reward_rate).toBeLessThan(0.000001);
  });

  it('accepts merchant_id override', () => {
    const c = campaignFactory.build({ merchant_id: 42 });
    expect(c.merchant_id).toBe(42);
  });
});

describe('userFactory', () => {
  it('builds a regular user', () => {
    const u = userFactory.build();
    expect(u.email).toContain('@');
    expect(u.is_admin).toBe(false);
    expect(u.wallet_address).toMatch(/^G[A-Z0-9]{55}$/);
  });

  it('admin trait: is_admin true', () => {
    const u = userFactory.build(userFactory.params.admin());
    expect(u.is_admin).toBe(true);
  });
});

describe('rewardIssuanceFactory', () => {
  it('builds a reward issuance', () => {
    const r = rewardIssuanceFactory.build();
    expect(r.amount).toBeGreaterThan(0);
    expect(['pending', 'confirmed', 'failed']).toContain(r.status);
  });

  it('confirmed trait', () => {
    const r = rewardIssuanceFactory.build(rewardIssuanceFactory.params.confirmed());
    expect(r.status).toBe('confirmed');
  });

  it('failed trait: tx_hash is null', () => {
    const r = rewardIssuanceFactory.build(rewardIssuanceFactory.params.failed());
    expect(r.status).toBe('failed');
    expect(r.tx_hash).toBeNull();
  });
});
