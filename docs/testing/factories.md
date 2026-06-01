# Test Data Factories

Reusable test data factories for all Nova Rewards domain entities, built with [fishery](https://github.com/thoughtbot/fishery) and [@faker-js/faker](https://fakerjs.dev/).

**Location:** `novaRewards/backend/tests/fixtures/factories.js`

---

## Setup

fishery must be installed as a dev dependency:

```bash
cd novaRewards/backend
npm install --save-dev fishery
```

---

## Available Factories

| Factory | Prisma Model | File |
|---------|-------------|------|
| `merchantFactory` | `Merchant` | `tests/fixtures/factories.js` |
| `campaignFactory` | `Campaign` | `tests/fixtures/factories.js` |
| `userFactory` | `User` | `tests/fixtures/factories.js` |
| `rewardIssuanceFactory` | `RewardIssuance` | `tests/fixtures/factories.js` |

---

## Basic Usage

```js
const {
  merchantFactory,
  campaignFactory,
  userFactory,
  rewardIssuanceFactory,
} = require('./fixtures/factories');

// Build a single object
const merchant = merchantFactory.build();

// Build with field overrides
const campaign = campaignFactory.build({ merchant_id: merchant.id, name: 'VIP Rewards' });

// Build a list
const users = userFactory.buildList(5);
```

---

## Traits

Traits are pre-defined param sets for common test scenarios.

### Campaign traits

```js
// Expired campaign (end_date in the past, is_active: false)
const expired = campaignFactory.build(campaignFactory.params.expired());

// Depleted budget (reward_rate near zero)
const depleted = campaignFactory.build(campaignFactory.params.depletedBudget());
```

### User traits

```js
// Admin user
const admin = userFactory.build(userFactory.params.admin());
```

### RewardIssuance traits

```js
// Confirmed on-chain
const confirmed = rewardIssuanceFactory.build(rewardIssuanceFactory.params.confirmed());

// Failed issuance (tx_hash is null)
const failed = rewardIssuanceFactory.build(rewardIssuanceFactory.params.failed());
```

---

## Using in Unit Tests (Jest)

```js
const { campaignFactory } = require('../fixtures/factories');

describe('validateCampaign', () => {
  it('rejects an expired campaign', () => {
    const campaign = campaignFactory.build(campaignFactory.params.expired());
    expect(() => validateCampaign(campaign)).toThrow('Campaign has expired');
  });
});
```

## Using in Integration Tests (Supertest)

```js
const request = require('supertest');
const app = require('../server');
const { merchantFactory, campaignFactory } = require('./fixtures/factories');

it('POST /campaigns returns 201', async () => {
  const merchant = merchantFactory.build();
  // Seed merchant into DB or mock the repository, then:
  const body = campaignFactory.build({ merchant_id: merchant.id });

  const res = await request(app)
    .post('/api/campaigns')
    .set('x-api-key', merchant.api_key)
    .send(body);

  expect(res.status).toBe(201);
});
```

---

## Adding a New Factory

1. Define the factory in `tests/fixtures/factories.js` following the existing pattern.
2. Add traits for common scenarios using `Factory.params`.
3. Export it from the module.
4. Add a smoke test in `tests/factories.test.js`.
5. Update the table in this document.
