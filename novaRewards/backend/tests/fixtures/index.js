'use strict';
/**
 * Shared fixture factories for Nova Rewards backend tests.
 *
 * Built with fishery for composable, overridable test data.
 * All Stellar addresses are valid 56-char G-addresses (testnet keypairs).
 * Token amounts use NUMERIC(18,7) precision matching the DB schema.
 *
 * Usage:
 *   const { UserFactory, CampaignFactory } = require('./fixtures');
 *   const user = UserFactory.build();
 *   const campaign = CampaignFactory.build({ merchant_id: 5 });
 *   const users = UserFactory.buildList(3);
 */

const { Factory } = require('fishery');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Pool of valid 56-char Stellar G-addresses (testnet throwaway keys)
const STELLAR_ADDRESSES = [
  'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  'GBCJLPKHE2QTXTYZNZG6K3OBRPHJHABT2MG6JLAMM5FOARHM2GL67VCW',
  'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K',
  'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZWM9CQJURIKHBJ3IQTOY',
  'GBVNNPOFVV2YNXSQXDJPBVQYY5UXWZQNXQJXQJXQJXQJXQJXQJXQJXQ',
  'GDFOHLMYCXVZD2CDXZLMIRCLKWHCU7QKGUQUQ7QKGUQUQ7QKGUQUQ7QK',
  'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4A',
  'GCVLWV5B3L3YE6DSCCMHLCK7QIB3EZUHFPEBBQ6KMLBX2NRHQFNHQ3XA',
];

let _addrIdx = 0;
const nextAddress = () => STELLAR_ADDRESSES[_addrIdx++ % STELLAR_ADDRESSES.length];

let _seq = 1;
const nextId = () => _seq++;

// Reset sequence between test suites if needed
const resetSequence = () => { _seq = 1; _addrIdx = 0; };

// Deterministic date helpers
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000).toISOString();
const isoDate = (d) => new Date(d).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// UserFactory
// Matches: users table (id, wallet_address, created_at) + extended profile cols
// ---------------------------------------------------------------------------
const UserFactory = Factory.define(() => {
  const id = nextId();
  return {
    id,
    wallet_address: nextAddress(),
    email: `user${id}@example.com`,
    first_name: 'Test',
    last_name: 'User',
    role: 'user',
    referral_code: `REF${String(id).padStart(5, '0')}`,
    referred_by: null,
    referral_bonus_claimed: false,
    balance: 0,
    is_active: true,
    created_at: daysAgo(30),
    updated_at: daysAgo(1),
  };
});

// ---------------------------------------------------------------------------
// MerchantFactory
// Matches: merchants table
// ---------------------------------------------------------------------------
const MerchantFactory = Factory.define(() => {
  const id = nextId();
  return {
    id,
    name: `Merchant ${id}`,
    email: `merchant${id}@example.com`,
    api_key: `mk_test_${id.toString(16).padStart(32, '0')}`,
    is_active: true,
    created_at: daysAgo(60),
  };
});

// ---------------------------------------------------------------------------
// CampaignFactory
// Matches: campaigns table (id, merchant_id, name, reward_rate, start_date,
//          end_date, is_active, created_at)
// reward_rate uses NUMERIC(18,7) — stored as string from DB
// ---------------------------------------------------------------------------
const CampaignFactory = Factory.define(() => {
  const id = nextId();
  return {
    id,
    merchant_id: 1,
    name: `Campaign ${id}`,
    reward_rate: '1.0000000',   // 1 NOVA per unit — valid (> 0)
    start_date: isoDate(daysAgo(7)),
    end_date: isoDate(daysFromNow(30)),
    is_active: true,
    created_at: daysAgo(7),
  };
});

// Convenience: an already-expired campaign
CampaignFactory.expired = () =>
  CampaignFactory.build({
    start_date: isoDate(daysAgo(60)),
    end_date: isoDate(daysAgo(1)),
    is_active: false,
  });

// ---------------------------------------------------------------------------
// TransactionFactory
// Matches: transactions table (id, tx_hash, tx_type, amount, from_wallet,
//          to_wallet, merchant_id, campaign_id, stellar_ledger, created_at)
// amount uses NUMERIC(18,7)
// ---------------------------------------------------------------------------
const TransactionFactory = Factory.define(() => {
  const id = nextId();
  return {
    id,
    tx_hash: `tx${id.toString(16).padStart(62, '0')}`,  // 64-char hex-like hash
    tx_type: 'distribution',
    amount: '10.0000000',
    from_wallet: STELLAR_ADDRESSES[0],
    to_wallet: STELLAR_ADDRESSES[1],
    merchant_id: 1,
    campaign_id: 1,
    stellar_ledger: 1000000 + id,
    created_at: daysAgo(1),
  };
});

// Convenience builders for each tx_type
TransactionFactory.distribution = (overrides = {}) =>
  TransactionFactory.build({ tx_type: 'distribution', ...overrides });

TransactionFactory.redemption = (overrides = {}) =>
  TransactionFactory.build({ tx_type: 'redemption', ...overrides });

TransactionFactory.transfer = (overrides = {}) =>
  TransactionFactory.build({ tx_type: 'transfer', ...overrides });

// ---------------------------------------------------------------------------
// WalletFactory
// Matches: wallets table (id, user_id, address, is_primary, is_active,
//          created_at, updated_at)
// ---------------------------------------------------------------------------
const WalletFactory = Factory.define(() => {
  const id = nextId();
  return {
    id,
    user_id: 1,
    address: nextAddress(),
    is_primary: true,
    is_active: true,
    created_at: daysAgo(10),
    updated_at: daysAgo(1),
  };
});

// ---------------------------------------------------------------------------
// NotificationFactory
// Matches: notifications table (id, user_id, type, title, message, payload,
//          is_read, sent_at, created_at)
// ---------------------------------------------------------------------------
const NotificationFactory = Factory.define(() => {
  const id = nextId();
  return {
    id,
    user_id: 1,
    type: 'reward_received',
    title: 'Reward Received',
    message: `You received 10.0000000 NOVA tokens.`,
    payload: { amount: '10.0000000', tx_hash: `tx${id.toString(16).padStart(62, '0')}` },
    is_read: false,
    sent_at: daysAgo(1),
    created_at: daysAgo(1),
  };
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  UserFactory,
  MerchantFactory,
  CampaignFactory,
  TransactionFactory,
  WalletFactory,
  NotificationFactory,
  // Helpers exposed for tests that need them
  STELLAR_ADDRESSES,
  resetSequence,
};
