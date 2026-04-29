/**
 * Test Data Factories — Nova Rewards Backend
 *
 * Uses fishery + @faker-js/faker. Shapes match the PostgreSQL schema.
 *
 * Usage:
 *   const { userFactory, campaignFactory, transactionFactory,
 *           rewardFactory, walletFactory, rewardIssuanceFactory,
 *           merchantFactory } = require('./factories');
 *
 *   const user     = userFactory.build();
 *   const admin    = userFactory.build(userFactory.params.admin());
 *   const expired  = campaignFactory.build(campaignFactory.params.expired());
 *   const batch    = transactionFactory.buildList(50);
 */

'use strict';

const { Factory } = require('fishery');
const { faker }   = require('@faker-js/faker');

// ── Helpers ───────────────────────────────────────────────────────────────

/** Valid Stellar public key: G + 55 uppercase alphanumeric chars */
const stellarAddress = () =>
  'G' + faker.string.alphanumeric({ length: 55, casing: 'upper' });

/** YYYY-MM-DD string */
const isoDate = (d) => d.toISOString().split('T')[0];

const daysAgo  = (n) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n) => new Date(Date.now() + n * 86_400_000);

// ── Merchant ──────────────────────────────────────────────────────────────

const merchantFactory = Factory.define(({ sequence }) => ({
  id: sequence,
  name: faker.company.name(),
  wallet_address: stellarAddress(),
  business_category: faker.helpers.arrayElement([
    'food_and_beverage', 'retail', 'entertainment', 'travel', 'health_and_wellness',
  ]),
  api_key: faker.string.alphanumeric({ length: 64, casing: 'lower' }),
  is_active: true,
  created_at: faker.date.recent({ days: 90 }),
}));

// ── User ──────────────────────────────────────────────────────────────────

const userFactory = Factory.define(({ sequence }) => ({
  id: sequence,
  email: faker.internet.email(),
  first_name: faker.person.firstName(),
  last_name: faker.person.lastName(),
  wallet_address: stellarAddress(),
  stellar_public_key: stellarAddress(),
  referral_code: faker.string.alphanumeric({ length: 8, casing: 'upper' }),
  referred_by: null,
  balance: faker.number.int({ min: 0, max: 10_000 }),
  role: 'user',
  is_admin: false,
  is_deleted: false,
  created_at: faker.date.recent({ days: 180 }),
}));

userFactory.params.admin    = () => ({ role: 'admin',    is_admin: true });
userFactory.params.merchant = () => ({ role: 'merchant', is_admin: false });
userFactory.params.deleted  = () => ({ is_deleted: true, deleted_at: faker.date.recent({ days: 7 }) });

// ── Campaign ──────────────────────────────────────────────────────────────

const campaignFactory = Factory.define(({ sequence, params }) => {
  const start = params.start_date ?? isoDate(faker.date.recent({ days: 30 }));
  const end   = params.end_date   ?? isoDate(daysAhead(faker.number.int({ min: 7, max: 90 })));

  return {
    id: sequence,
    merchant_id: params.merchant_id ?? faker.number.int({ min: 1, max: 100 }),
    name: `${faker.commerce.productName()} Rewards`,
    reward_rate: parseFloat(faker.number.float({ min: 0.01, max: 0.1, fractionDigits: 7 })),
    start_date: start,
    end_date: end,
    is_active: params.is_active ?? true,
    on_chain_status: params.on_chain_status ?? 'confirmed',
    contract_campaign_id: faker.string.hexadecimal({ length: 64, casing: 'lower' }),
    created_at: faker.date.recent({ days: 90 }),
  };
});

campaignFactory.params.expired       = () => ({
  start_date: isoDate(daysAgo(60)),
  end_date:   isoDate(daysAgo(1)),
  is_active:  false,
});
campaignFactory.params.pending       = () => ({ on_chain_status: 'pending' });
campaignFactory.params.depletedBudget = () => ({ reward_rate: 0.0000001 });

// ── Transaction ───────────────────────────────────────────────────────────

const transactionFactory = Factory.define(({ sequence, params }) => ({
  id: sequence,
  tx_hash: faker.string.hexadecimal({ length: 64, casing: 'lower' }).replace('0x', ''),
  tx_type: params.tx_type ?? faker.helpers.arrayElement(['distribution', 'redemption', 'transfer']),
  amount: parseFloat(faker.number.float({ min: 0.1, max: 1_000, fractionDigits: 7 })),
  from_wallet: params.from_wallet ?? stellarAddress(),
  to_wallet:   params.to_wallet   ?? stellarAddress(),
  merchant_id: params.merchant_id ?? faker.number.int({ min: 1, max: 100 }),
  campaign_id: params.campaign_id ?? faker.number.int({ min: 1, max: 100 }),
  stellar_ledger: faker.number.int({ min: 1_000_000, max: 50_000_000 }),
  status: params.status ?? 'confirmed',
  created_at: faker.date.recent({ days: 30 }),
}));

transactionFactory.params.distribution = () => ({ tx_type: 'distribution' });
transactionFactory.params.redemption   = () => ({ tx_type: 'redemption' });
transactionFactory.params.transfer     = () => ({ tx_type: 'transfer' });
transactionFactory.params.pending      = () => ({ status: 'pending' });
transactionFactory.params.failed       = () => ({ status: 'failed' });

// ── Reward ────────────────────────────────────────────────────────────────

const rewardFactory = Factory.define(({ sequence }) => ({
  id: sequence,
  name: faker.commerce.productName(),
  description: faker.commerce.productDescription(),
  cost: faker.number.int({ min: 10, max: 5_000 }),
  stock: faker.number.int({ min: 0, max: 500 }),
  is_active: true,
  is_deleted: false,
  created_at: faker.date.recent({ days: 60 }),
}));

rewardFactory.params.outOfStock = () => ({ stock: 0 });
rewardFactory.params.inactive   = () => ({ is_active: false });

// ── Wallet ────────────────────────────────────────────────────────────────

const walletFactory = Factory.define(({ sequence, params }) => ({
  id: sequence,
  user_id: params.user_id ?? faker.number.int({ min: 1, max: 1_000 }),
  address: stellarAddress(),
  is_primary: params.is_primary ?? false,
  is_active: true,
  created_at: faker.date.recent({ days: 90 }),
}));

walletFactory.params.primary  = () => ({ is_primary: true });
walletFactory.params.inactive = () => ({ is_active: false });

// ── RewardIssuance ────────────────────────────────────────────────────────

const rewardIssuanceFactory = Factory.define(({ sequence, params }) => ({
  id: sequence,
  idempotency_key: faker.string.uuid(),
  user_id: params.user_id ?? faker.number.int({ min: 1, max: 1_000 }),
  campaign_id: params.campaign_id ?? faker.number.int({ min: 1, max: 100 }),
  wallet_address: stellarAddress(),
  amount: parseFloat(faker.number.float({ min: 0.1, max: 500, fractionDigits: 7 })),
  status: params.status ?? faker.helpers.arrayElement(['pending', 'confirmed', 'failed']),
  tx_hash: faker.string.hexadecimal({ length: 64, casing: 'lower' }).replace('0x', ''),
  error_message: null,
  attempts: faker.number.int({ min: 0, max: 3 }),
  created_at: faker.date.recent({ days: 30 }),
  updated_at: faker.date.recent({ days: 1 }),
}));

rewardIssuanceFactory.params.confirmed = () => ({ status: 'confirmed' });
rewardIssuanceFactory.params.failed    = () => ({
  status: 'failed',
  tx_hash: null,
  error_message: faker.helpers.arrayElement([
    'Insufficient balance',
    'Trustline not established',
    'Network timeout',
  ]),
  attempts: 3,
});
rewardIssuanceFactory.params.pending = () => ({ status: 'pending', tx_hash: null, attempts: 0 });

// ── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  merchantFactory,
  userFactory,
  campaignFactory,
  transactionFactory,
  rewardFactory,
  walletFactory,
  rewardIssuanceFactory,
};
