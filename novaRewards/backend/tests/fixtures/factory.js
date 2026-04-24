const { faker } = require('@faker-js/faker');

/**
 * Test Data Factory using Faker.js
 * Usage: const data = factories.user();
 */

const factories = {
  user: () => ({
    id: faker.number.int(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    referral_code: faker.string.alphanumeric({ length: { min: 6, max: 8 } }).toUpperCase(),
    referred_by: null,
    balance: faker.number.int({ min: 0, max: 10000 }),
    token: faker.string.jwt(),
    created_at: faker.date.recent(),
  }),

  merchant: () => ({
    id: faker.number.int(),
    name: faker.company.name(),
    api_key: faker.string.uuid(),
    created_at: faker.date.recent(),
  }),

  campaign: () => ({
    id: faker.number.int(),
    merchant_id: faker.number.int({ min: 1, max: 10 }),
    name: faker.commerce.productName(),
    points_per_dollar: parseFloat(faker.number.float({ min: 0.5, max: 2.0, precision: 0.01 })),
    active: faker.datatype.boolean(),
    created_at: faker.date.recent(),
  }),

  transaction: () => ({
    id: faker.number.int(),
    user_id: faker.number.int({ min: 1 }),
    campaign_id: faker.number.int({ min: 1 }),
    amount: parseFloat(faker.number.float({ min: 1, max: 100, precision: 0.01 })),
    points_earned: faker.number.int({ min: 1, max: 100 }),
    tx_hash: faker.string.uuid(),
    status: faker.helpers.shuffle(['pending', 'confirmed', 'failed'])[0],
    created_at: faker.date.recent(),
  }),

  // Security test payloads
  sqliPayload: () => faker.helpers.arrayElement([
    "'; DROP TABLE users; --",
    "' OR 1=1--",
    "'; SELECT * FROM users WHERE id = 1--",
    "' UNION SELECT username, password FROM users--",
  ]),

  xssPayload: () => faker.helpers.arrayElement([
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "\" onclick=alert('XSS')>",
  ]),
};

module.exports = { factories };
