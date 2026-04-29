/**
 * Test Data Factories — Nova Rewards
 *
 * Uses fishery (https://github.com/thoughtbot/fishery) with @faker-js/faker.
 * Factories match Prisma model shapes and pass all validation rules.
 *
 * Usage:
 *   import { merchantFactory, campaignFactory, userFactory, rewardIssuanceFactory } from './factories';
 *
 *   const merchant  = merchantFactory.build();
 *   const campaign  = campaignFactory.build({ merchant_id: merchant.id });
 *   const expired   = campaignFactory.build(campaignFactory.params.expired());
 *   const adminUser = userFactory.build(userFactory.params.admin());
 */

const { Factory } = require('fishery');
const { faker } = require('@faker-js/faker');

// ── Helpers ───────────────────────────────────────────────────────────────

/** Generate a valid Stellar public key (G + 55 uppercase alphanumeric chars) */
const stellarAddress = () =>
  'G' + faker.string.alphanumeric({ length: 55, casing: 'upper' });

/** ISO date string (YYYY-MM-DD) */
const isoDate = (d) => d.toISOString().split('T')[0];

// ── Merchant ──────────────────────────────────────────────────────────────

const merchantFactory = Factory.define(({ sequence }) => ({
  id: sequence,
  name: faker.company.name(),
  wallet_address: stellarAddress(),
  business_category: faker.helpers.arrayElement([
    'food_and_beverage',
    'retail',
    'entertainment',
    'travel',
    'health_and_wellness',
  ]),
  api_key: faker.string.alphanumeric({ length: 64, casing: 'lower' }),
  created_at: faker.date.recent({ days: 90 }),
}));

// ── Campaign ──────────────────────────────────────────────────────────────

const campaignFactory = Factory.define(({ sequence, params }) => {
  const now = new Date();
  const start = params.start_date ?? isoDate(faker.date.recent({ days: 30 }));
  const end   = params.end_date   ?? isoDate(faker.date.soon({ days: 60 }));

  return {
    id: sequence,
    merchant_id: params.merchant_id ?? faker.number.int({ min: 1, max: 100 }),
    name: faker.commerce.productName() + ' Rewards',
    reward_rate: parseFloat(faker.number.float({ min: 0.01, max: 0.1, fractionDigits: 7 })),
    start_date: start,
    end_date: end,
    is_active: params.is_active ?? true,
    created_at: faker.date.recent({ days: 90 }),
  };
});

/** Trait: campaign whose end_date is in the past */
campaignFactory.params.expired = () => ({
  start_date: isoDate(new Date(Date.now() - 60 * 86400_000)),
  end_date:   isoDate(new Date(Date.now() - 1  * 86400_000)),
  is_active:  false,
});

/** Trait: campaign with a very low reward_rate (simulates depleted budget) */
campaignFactory.params.depletedBudget = () => ({
  reward_rate: 0.0000001,
});

// ── User ──────────────────────────────────────────────────────────────────

const userFactory = Factory.define(({ sequence }) => ({
  id: sequence,
  email: faker.internet.email(),
  name: faker.person.fullName(),
  wallet_address: stellarAddress(),
  referral_code: faker.string.alphanumeric({ length: 8, casing: 'upper' }),
  referred_by: null,
  balance: faker.number.int({ min: 0, max: 10_000 }),
  is_admin: false,
  created_at: faker.date.recent({ days: 180 }),
}));

/** Trait: admin user */
userFactory.params.admin = () => ({ is_admin: true });

// ── RewardIssuance ────────────────────────────────────────────────────────

const rewardIssuanceFactory = Factory.define(({ sequence }) => ({
  id: sequence,
  user_id:     faker.number.int({ min: 1, max: 1000 }),
  campaign_id: faker.number.int({ min: 1, max: 100 }),
  amount:      parseFloat(faker.number.float({ min: 0.1, max: 500, fractionDigits: 7 })),
  tx_hash:     faker.string.hexadecimal({ length: 64, casing: 'lower' }),
  status:      faker.helpers.arrayElement(['pending', 'confirmed', 'failed']),
  created_at:  faker.date.recent({ days: 30 }),
}));

/** Trait: confirmed on-chain issuance */
rewardIssuanceFactory.params.confirmed = () => ({ status: 'confirmed' });

/** Trait: failed issuance */
rewardIssuanceFactory.params.failed = () => ({ status: 'failed', tx_hash: null });

// ── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  merchantFactory,
  campaignFactory,
  userFactory,
  rewardIssuanceFactory,
};
