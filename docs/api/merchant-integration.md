# Merchant Integration Guide

This guide covers the complete merchant workflow on Nova Rewards — from registering your account through distributing NOVA tokens and tracking redemptions via the API. It is written for developers building merchant integrations.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Register as a Merchant](#2-register-as-a-merchant)
3. [API Authentication](#3-api-authentication)
4. [Test in the Testnet Environment First](#4-test-in-the-testnet-environment-first)
5. [Create a Campaign](#5-create-a-campaign)
6. [Fund a Campaign](#6-fund-a-campaign)
7. [Distribute Tokens (Issue Rewards)](#7-distribute-tokens-issue-rewards)
8. [Track Results](#8-track-results)
9. [Webhook Setup and Payload Verification](#9-webhook-setup-and-payload-verification)
10. [Redemption Tracking](#10-redemption-tracking)
11. [Error Handling and Retry Strategy](#11-error-handling-and-retry-strategy)
12. [Go Live on Mainnet](#12-go-live-on-mainnet)

---

## 1. Prerequisites

Before you start, you need:

- A Stellar wallet keypair. Use [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test) to generate one on testnet.
- Your wallet must be funded with at least 2 XLM (for account activation and transaction fees). On testnet, use the Friendbot faucet linked above.
- `curl` or any HTTP client for the examples below.

---

## 2. Register as a Merchant

Registration creates your merchant account and returns a one-time API key. Store it immediately — it is never shown again.

```bash
curl -X POST https://api.nova-rewards.io/api/merchants/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Coffee",
    "wallet_address": "GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K",
    "business_category": "food_and_beverage"
  }'
```

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": 12,
      "name": "Acme Coffee",
      "wallet_address": "GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K",
      "business_category": "food_and_beverage",
      "created_at": "2026-06-01T10:00:00Z"
    },
    "api_key": "nova_live_sk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
  }
}
```

> **Security:** Store `api_key` in an environment variable or secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.). Never commit it to source control.

### Rotate an API key

If a key is compromised, rotate it immediately. The old key is invalidated as soon as the new one is issued.

```bash
curl -X POST https://api.nova-rewards.io/api/merchants/rotate-key \
  -H "Content-Type: application/json" \
  -H "x-api-key: $NOVA_API_KEY"
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "api_key": "nova_live_sk_z9y8x7w6v5u4z9y8x7w6v5u4z9y8x7w6"
  }
}
```

---

## 3. API Authentication

All merchant endpoints require the `x-api-key` header. User-facing endpoints use a Bearer JWT instead — see the [API README](./README.md) for details.

```bash
# Every merchant request looks like this
curl https://api.nova-rewards.io/api/campaigns \
  -H "x-api-key: $NOVA_API_KEY"
```

Requests with a missing or invalid key return `401 Unauthorized`:

```json
{
  "success": false,
  "error": "unauthorized",
  "message": "Invalid or missing API key"
}
```

### Reusable helper (Node.js)

```javascript
const BASE_URL = process.env.NOVA_BASE_URL || 'https://api.nova-rewards.io';

async function novaRequest(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.NOVA_API_KEY,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.message || `HTTP ${res.status}`);
    error.status = res.status;
    error.code   = err.error;
    throw error;
  }

  return res.json();
}
```

---

## 4. Test in the Testnet Environment First

The testnet environment mirrors production exactly but uses Stellar testnet — no real tokens are issued and no real XLM is spent.

| Setting | Value |
|---------|-------|
| Base URL | `https://sandbox.nova-rewards.io` |
| Stellar network | `testnet` |
| Horizon URL | `https://horizon-testnet.stellar.org` |
| Stellar testnet faucet | https://laboratory.stellar.org/#account-creator?network=test |

### Step 1 — Get a testnet wallet

```bash
# Generate a keypair and fund it via Friendbot
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
```

### Step 2 — Set your environment

```bash
export NOVA_BASE_URL=https://sandbox.nova-rewards.io
export NOVA_API_KEY=nova_test_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export STELLAR_NETWORK=testnet
```

### Step 3 — Register on testnet

```bash
curl -X POST $NOVA_BASE_URL/api/merchants/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Coffee (test)",
    "wallet_address": "YOUR_TESTNET_PUBLIC_KEY",
    "business_category": "food_and_beverage"
  }'
```

Save the returned `api_key` as `NOVA_API_KEY` and run through the full workflow below before switching to production.

---

## 5. Create a Campaign

A campaign defines the reward rate (NOVA tokens per USD spent) and the active window. Users earn rewards only while a campaign is active.

```bash
curl -X POST $NOVA_BASE_URL/api/campaigns \
  -H "Content-Type: application/json" \
  -H "x-api-key: $NOVA_API_KEY" \
  -d '{
    "name": "Summer Loyalty Boost",
    "reward_rate": 0.05,
    "start_date": "2026-06-01",
    "end_date": "2026-08-31"
  }'
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name for the campaign (unique per merchant) |
| `reward_rate` | number | NOVA tokens issued per USD of purchase amount |
| `start_date` | string | ISO 8601 date — campaign becomes active at 00:00 UTC |
| `end_date` | string | ISO 8601 date — campaign deactivates at 23:59 UTC |

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": 7,
    "merchant_id": 12,
    "name": "Summer Loyalty Boost",
    "reward_rate": 0.05,
    "start_date": "2026-06-01",
    "end_date": "2026-08-31",
    "is_active": true,
    "created_at": "2026-05-31T09:00:00Z"
  }
}
```

Save the `id` — you will use it when issuing rewards.

### List your campaigns

```bash
curl $NOVA_BASE_URL/api/campaigns \
  -H "x-api-key: $NOVA_API_KEY"
```

### Update a campaign

```bash
curl -X PATCH $NOVA_BASE_URL/api/campaigns/7 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $NOVA_API_KEY" \
  -d '{"end_date": "2026-09-30"}'
```

---

## 6. Fund a Campaign

Before rewards can be distributed, your campaign must hold enough NOVA tokens. Funding transfers tokens from your merchant wallet to the campaign's escrow on the Stellar network.

### Step 1 — Check your NOVA balance

```bash
curl $NOVA_BASE_URL/api/merchants/me/balance \
  -H "x-api-key: $NOVA_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "nova_balance": "5000.0000000",
    "xlm_balance": "98.5000000",
    "wallet_address": "GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K"
  }
}
```

### Step 2 — Fund the campaign

```bash
curl -X POST $NOVA_BASE_URL/api/campaigns/7/fund \
  -H "Content-Type: application/json" \
  -H "x-api-key: $NOVA_API_KEY" \
  -d '{
    "amount": "1000.0000000"
  }'
```

**Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "campaign_id": 7,
    "funded_amount": "1000.0000000",
    "campaign_balance": "1000.0000000",
    "tx_hash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
  }
}
```

The `tx_hash` is the Stellar transaction ID. You can verify it on [Stellar Expert](https://stellar.expert/explorer/testnet) (testnet) or [Stellar Expert mainnet](https://stellar.expert/explorer/public).

### Step 3 — Verify campaign balance

```bash
curl $NOVA_BASE_URL/api/campaigns/7 \
  -H "x-api-key: $NOVA_API_KEY"
```

The response includes `campaign_balance` — rewards can only be issued up to this amount.

---

## 7. Distribute Tokens (Issue Rewards)

Call this endpoint each time a customer completes a qualifying purchase. The API calculates the NOVA amount from `purchase_amount * reward_rate`, deducts it from the campaign balance, and submits the on-chain transfer.

```bash
curl -X POST $NOVA_BASE_URL/api/rewards/issue \
  -H "Content-Type: application/json" \
  -H "x-api-key: $NOVA_API_KEY" \
  -d '{
    "user_id": 42,
    "campaign_id": 7,
    "purchase_amount": 50.00
  }'
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | integer | Nova Rewards user ID of the customer |
| `campaign_id` | integer | ID of the active campaign to draw from |
| `purchase_amount` | number | Purchase value in USD |

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "reward_id": 1001,
    "user_id": 42,
    "campaign_id": 7,
    "nova_amount": "2.5000000",
    "tx_hash": "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
    "status": "confirmed",
    "created_at": "2026-06-15T14:30:00Z"
  }
}
```

> **Trustline requirement:** The user must have established a Stellar trustline for the NOVA asset before receiving tokens. If they have not, the API returns `422 Unprocessable Entity` with `error: "trustline_missing"`. Direct the user to the Nova Rewards app to set up their wallet.

### Idempotency

To safely retry failed requests without double-issuing rewards, include an `Idempotency-Key` header:

```bash
curl -X POST $NOVA_BASE_URL/api/rewards/issue \
  -H "Content-Type: application/json" \
  -H "x-api-key: $NOVA_API_KEY" \
  -H "Idempotency-Key: order-8675309-user-42" \
  -d '{
    "user_id": 42,
    "campaign_id": 7,
    "purchase_amount": 50.00
  }'
```

Duplicate requests with the same key return the original response with `200 OK` instead of creating a new reward.

### Batch distribution

For bulk reward issuance (e.g., end-of-day batch processing):

```bash
curl -X POST $NOVA_BASE_URL/api/rewards/batch \
  -H "Content-Type: application/json" \
  -H "x-api-key: $NOVA_API_KEY" \
  -d '{
    "campaign_id": 7,
    "rewards": [
      { "user_id": 42, "purchase_amount": 50.00 },
      { "user_id": 43, "purchase_amount": 120.00 },
      { "user_id": 44, "purchase_amount": 30.00 }
    ]
  }'
```

**Response `202 Accepted`:**

```json
{
  "success": true,
  "data": {
    "batch_id": "batch_abc123",
    "queued": 3,
    "status": "processing"
  }
}
```

Poll `GET /api/rewards/batch/batch_abc123` to check completion status.

---

## 8. Track Results

### Campaign analytics

```bash
curl "$NOVA_BASE_URL/api/campaigns/7/analytics" \
  -H "x-api-key: $NOVA_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "campaign_id": 7,
    "total_rewards_issued": 142,
    "total_nova_distributed": "355.0000000",
    "campaign_balance_remaining": "645.0000000",
    "unique_users_rewarded": 98,
    "total_purchase_volume_usd": "7100.00",
    "period": {
      "start": "2026-06-01",
      "end": "2026-08-31"
    }
  }
}
```

### Paginated reward history

```bash
curl "$NOVA_BASE_URL/api/rewards?campaign_id=7&page=1&limit=20" \
  -H "x-api-key: $NOVA_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "reward_id": 1001,
      "user_id": 42,
      "campaign_id": 7,
      "nova_amount": "2.5000000",
      "tx_hash": "b2c3d4...",
      "status": "confirmed",
      "created_at": "2026-06-15T14:30:00Z"
    }
  ],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

### Merchant transaction totals

```bash
curl $NOVA_BASE_URL/api/transactions/merchant-totals \
  -H "x-api-key: $NOVA_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total_distributed": "355.0000000",
    "total_redeemed": "120.0000000"
  }
}
```

---

## 9. Webhook Setup and Payload Verification

Webhooks let Nova Rewards push real-time events to your server instead of requiring you to poll. Register an HTTPS endpoint and Nova will POST a signed payload whenever a relevant event occurs.

### Supported event types

| Event | Triggered when |
|-------|---------------|
| `reward.issued` | A reward is successfully distributed to a user |
| `reward.failed` | A reward issuance fails (e.g., trustline missing) |
| `campaign.funded` | A campaign receives a funding deposit |
| `campaign.expired` | A campaign's `end_date` passes |
| `campaign.balance_low` | Campaign balance drops below 10% of initial funding |
| `redemption.completed` | A user redeems tokens through your campaign |
| `test` | Synthetic event sent via the test endpoint |

```bash
# List all supported event types
curl $NOVA_BASE_URL/api/webhooks/events \
  -H "x-api-key: $NOVA_API_KEY"
```

### Register a webhook

```bash
curl -X POST $NOVA_BASE_URL/api/webhooks \
  -H "Content-Type: application/json" \
  -H "x-api-key: $NOVA_API_KEY" \
  -d '{
    "url": "https://yourapp.com/webhooks/nova",
    "events": ["reward.issued", "campaign.expired", "redemption.completed"]
  }'
```

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": 5,
    "url": "https://yourapp.com/webhooks/nova",
    "events": ["reward.issued", "campaign.expired", "redemption.completed"],
    "is_active": true,
    "secret": "whsec_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "created_at": "2026-06-01T10:00:00Z"
  }
}
```

> **Important:** The `secret` is returned only once at creation. Store it securely — you will use it to verify every incoming payload. If you lose it, delete the webhook and create a new one.

### Webhook payload structure

Every webhook POST has this shape:

```json
{
  "id": "evt_01j2k3l4m5n6o7p8q9r0s1t2u3",
  "type": "reward.issued",
  "created_at": "2026-06-15T14:30:00Z",
  "data": {
    "reward_id": 1001,
    "user_id": 42,
    "campaign_id": 7,
    "nova_amount": "2.5000000",
    "tx_hash": "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
    "status": "confirmed"
  }
}
```

The `x-nova-signature` header contains the HMAC-SHA256 hex digest of the raw request body, signed with your webhook secret.

### Verify the signature

**Always verify the signature before processing a webhook.** Skipping this check allows anyone to send fake events to your endpoint.

```javascript
// Node.js / Express example
const crypto = require('crypto');

// Use a raw-body middleware so you have access to the unparsed bytes.
// With Express: app.use('/webhooks/nova', express.raw({ type: 'application/json' }))

function verifyNovaSignature(rawBody, signatureHeader, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)           // rawBody must be a Buffer or string — NOT a parsed object
    .digest('hex');

  const provided = signatureHeader.replace(/^sha256=/, '');

  // Constant-time comparison prevents timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(provided,  'hex'),
  );
}

app.post('/webhooks/nova', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-nova-signature'];

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  if (!verifyNovaSignature(req.body, signature, process.env.NOVA_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body.toString());

  switch (event.type) {
    case 'reward.issued':
      // event.data: { reward_id, user_id, campaign_id, nova_amount, tx_hash, status }
      console.log(`Reward ${event.data.reward_id}: ${event.data.nova_amount} NOVA → user ${event.data.user_id}`);
      break;

    case 'campaign.expired':
      // event.data: { campaign_id, name, total_distributed }
      console.log(`Campaign ${event.data.campaign_id} ("${event.data.name}") expired`);
      break;

    case 'campaign.balance_low':
      // event.data: { campaign_id, balance_remaining, threshold_percent }
      console.warn(`Campaign ${event.data.campaign_id} balance low: ${event.data.balance_remaining} NOVA remaining`);
      break;

    case 'redemption.completed':
      // event.data: { redemption_id, user_id, campaign_id, nova_amount, redeemed_at }
      console.log(`Redemption ${event.data.redemption_id}: user ${event.data.user_id} redeemed ${event.data.nova_amount} NOVA`);
      break;

    default:
      // Unknown event type — acknowledge and ignore to stay forward-compatible
      break;
  }

  // Respond 200 quickly. Nova retries on non-2xx responses.
  res.status(200).json({ received: true });
});
```

### Retry behaviour

If your endpoint returns a non-2xx status or times out (>30 s), Nova retries with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

After 5 failed attempts the delivery is marked `failed` and no further retries occur. You can replay failed deliveries manually:

```bash
# View delivery log for webhook 5
curl "$NOVA_BASE_URL/api/webhooks/5/deliveries" \
  -H "x-api-key: $NOVA_API_KEY"
```

### Send a test event

Use this to verify your endpoint is reachable and your signature verification works before going live:

```bash
curl -X POST $NOVA_BASE_URL/api/webhooks/5/test \
  -H "x-api-key: $NOVA_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "delivered": true,
    "delivery_id": 88
  }
}
```

### Update or disable a webhook

```bash
# Disable a webhook temporarily
curl -X PATCH $NOVA_BASE_URL/api/webhooks/5 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $NOVA_API_KEY" \
  -d '{"is_active": false}'

# Update the URL and event list
curl -X PATCH $NOVA_BASE_URL/api/webhooks/5 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $NOVA_API_KEY" \
  -d '{
    "url": "https://yourapp.com/webhooks/nova-v2",
    "events": ["reward.issued", "redemption.completed"]
  }'
```

### Delete a webhook

```bash
curl -X DELETE $NOVA_BASE_URL/api/webhooks/5 \
  -H "x-api-key: $NOVA_API_KEY"
```

---

## 10. Redemption Tracking

Users redeem NOVA tokens through the Nova Rewards app. When a redemption is tied to one of your campaigns, you receive a `redemption.completed` webhook event and can also query the API directly.

```bash
# All redemptions for your campaigns
curl "$NOVA_BASE_URL/api/redemptions?page=1&limit=20" \
  -H "x-api-key: $NOVA_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 301,
      "user_id": 42,
      "campaign_id": 7,
      "nova_amount": "10.0000000",
      "status": "completed",
      "tx_hash": "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
      "redeemed_at": "2026-07-01T09:15:00Z"
    }
  ],
  "total": 18,
  "page": 1,
  "limit": 20
}
```

```bash
# Redemptions for a specific campaign
curl "$NOVA_BASE_URL/api/campaigns/7/redemptions" \
  -H "x-api-key: $NOVA_API_KEY"
```

---

## 11. Error Handling and Retry Strategy

### HTTP status codes

| Status | Meaning | Action |
|--------|---------|--------|
| `400` | Validation error | Fix the request body — check `error.details` |
| `401` | Missing or invalid API key | Verify `x-api-key` header |
| `403` | Action not permitted | Check merchant permissions |
| `404` | Resource not found | Verify IDs in the request |
| `409` | Conflict (e.g., duplicate campaign name) | Change the conflicting field |
| `422` | Business rule violation | Read `error` and `message` — e.g., `trustline_missing`, `campaign_inactive`, `insufficient_balance` |
| `429` | Rate limit exceeded | Back off and retry after the `Retry-After` header value |
| `500` | Internal server error | Retry with exponential backoff; contact support if persistent |

### Error response shape

```json
{
  "success": false,
  "error": "trustline_missing",
  "message": "User 42 has not established a NOVA trustline. Direct them to set up their wallet.",
  "details": {
    "user_id": 42,
    "asset": "NOVA"
  }
}
```

### Retry with exponential backoff (Node.js)

```javascript
async function novaRequestWithRetry(path, options = {}, maxRetries = 3) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await novaRequest(path, options);
    } catch (err) {
      // Do not retry client errors (4xx) except 429
      if (err.status >= 400 && err.status < 500 && err.status !== 429) throw err;

      if (attempt === maxRetries) throw err;

      const delay = Math.min(1000 * 2 ** attempt, 30000); // cap at 30 s
      console.warn(`Attempt ${attempt + 1} failed (${err.status}). Retrying in ${delay}ms…`);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
}
```

Full error code reference: [docs/error-codes.md](../error-codes.md)

---

## 12. Go Live on Mainnet

Once you have completed a full end-to-end test on testnet, switch to production:

1. **Register a production merchant account** at `https://api.nova-rewards.io/api/merchants/register` using your mainnet Stellar wallet.
2. **Update your environment variables:**
   ```bash
   export NOVA_BASE_URL=https://api.nova-rewards.io
   export NOVA_API_KEY=nova_live_sk_<your_production_key>
   export STELLAR_NETWORK=mainnet
   ```
3. **Fund your production wallet** with enough XLM for transaction fees and enough NOVA to cover your expected reward distribution volume.
4. **Create your first production campaign** and fund it.
5. **Register your production webhook endpoint** and verify the test event succeeds.
6. **Monitor** your campaign balance via the analytics endpoint and set up alerts on the `campaign.balance_low` webhook event.

### Testnet vs. mainnet differences

| | Testnet | Mainnet |
|-|---------|---------|
| Base URL | `https://sandbox.nova-rewards.io` | `https://api.nova-rewards.io` |
| Stellar network | `testnet` | `mainnet` |
| Horizon URL | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |
| NOVA tokens | Test tokens (no real value) | Real NOVA tokens |
| XLM | Free via Friendbot | Real XLM required |
| API key prefix | `nova_test_sk_` | `nova_live_sk_` |

---

## Postman Collection

A ready-to-import Postman collection with pre-configured environments for both testnet and mainnet is available at:

[`docs/api/postman/nova-rewards.postman_collection.json`](./postman/nova-rewards.postman_collection.json)

Import it, set the `NOVA_API_KEY` and `NOVA_BASE_URL` environment variables, and every request above is ready to run.
