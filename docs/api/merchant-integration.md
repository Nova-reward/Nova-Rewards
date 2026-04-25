# Merchant Integration Guide

This guide walks through integrating your application with the Nova Rewards API — from account setup through live reward issuance.

---

## Table of Contents

1. [Account Setup](#1-account-setup)
2. [API Authentication](#2-api-authentication)
3. [Sandbox Environment](#3-sandbox-environment)
4. [Campaign Creation](#4-campaign-creation)
5. [Webhook Integration](#5-webhook-integration)
6. [Reward Tracking](#6-reward-tracking)
7. [Error Handling](#7-error-handling)

---

## 1. Account Setup

### Merchant Registration

```typescript
const response = await fetch('https://api.nova-rewards.io/api/merchants/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Acme Coffee',
    wallet_address: 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K',
    business_category: 'food_and_beverage',
  }),
});

const { merchant, api_key } = await response.json();
// Store api_key securely — it is shown only once
```

### API Key Generation

API keys are issued at registration. To rotate a key:

```typescript
const response = await fetch('https://api.nova-rewards.io/api/merchants/rotate-key', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.NOVA_API_KEY!,
  },
});

const { api_key } = await response.json();
```

> Store API keys in environment variables or a secrets manager. Never commit them to source control.

---

## 2. API Authentication

All merchant API requests require the `x-api-key` header:

```typescript
const NOVA_BASE_URL = 'https://api.nova-rewards.io';

async function novaRequest(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${NOVA_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.NOVA_API_KEY!,
      ...options.headers,
    },
  });
}
```

Requests without a valid key return `401 Unauthorized`.

---

## 3. Sandbox Environment

Use the testnet environment for all development and QA work. It mirrors production but uses Stellar testnet and does not issue real tokens.

| Setting | Value |
|---------|-------|
| Base URL | `https://sandbox.nova-rewards.io` |
| Stellar network | `testnet` |
| Test API key | `nova_test_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| Stellar testnet faucet | https://laboratory.stellar.org/#account-creator |

### Sandbox test credentials

```bash
NOVA_API_KEY=nova_test_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOVA_BASE_URL=https://sandbox.nova-rewards.io
STELLAR_NETWORK=testnet
```

Request a sandbox account at [nova-rewards.io/sandbox](https://nova-rewards.io/sandbox) or use the Postman collection (see [postman/nova-rewards.postman_collection.json](./postman/nova-rewards.postman_collection.json)).

---

## 4. Campaign Creation

```typescript
interface CreateCampaignBody {
  name: string;
  reward_rate: number;   // NOVA tokens per dollar spent
  start_date: string;    // ISO 8601 date
  end_date: string;
}

async function createCampaign(body: CreateCampaignBody) {
  const res = await novaRequest('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Campaign creation failed: ${err.message}`);
  }

  return res.json(); // { id, merchant_id, name, reward_rate, start_date, end_date, is_active }
}

// Example
const campaign = await createCampaign({
  name: 'Summer Loyalty Boost',
  reward_rate: 0.05,
  start_date: '2026-06-01',
  end_date: '2026-08-31',
});
```

---

## 5. Webhook Integration

### Registering a Webhook

```typescript
const res = await novaRequest('/api/webhooks', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://yourapp.com/webhooks/nova',
    events: ['reward.issued', 'campaign.expired'],
    secret: process.env.NOVA_WEBHOOK_SECRET!,
  }),
});
```

### Webhook Signature Verification

Nova signs every webhook payload with HMAC-SHA256 using your webhook secret. Always verify the signature before processing.

```typescript
import crypto from 'crypto';
import { Request, Response } from 'express';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  // Constant-time comparison prevents timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex'),
  );
}

export async function webhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-nova-signature'] as string;
  const rawBody = (req as any).rawBody as string; // requires express raw-body middleware

  if (!verifyWebhookSignature(rawBody, signature, process.env.NOVA_WEBHOOK_SECRET!)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const event = JSON.parse(rawBody);

  switch (event.type) {
    case 'reward.issued':
      await handleRewardIssued(event.data);
      break;
    case 'campaign.expired':
      await handleCampaignExpired(event.data);
      break;
    default:
      // Unknown event — acknowledge and ignore
  }

  res.status(200).json({ received: true });
}

async function handleRewardIssued(data: {
  user_id: number;
  campaign_id: number;
  amount: number;
  tx_hash: string;
}) {
  console.log(`Reward issued: ${data.amount} NOVA to user ${data.user_id} (tx: ${data.tx_hash})`);
  // Update your local records
}

async function handleCampaignExpired(data: { campaign_id: number }) {
  console.log(`Campaign ${data.campaign_id} expired`);
}
```

### Triggering a Reward

```typescript
interface TriggerRewardBody {
  user_id: number;
  campaign_id: number;
  purchase_amount: number; // in USD
}

async function triggerReward(body: TriggerRewardBody) {
  const res = await novaRequest('/api/rewards/issue', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Reward trigger failed: ${err.message}`);
  }

  return res.json(); // { reward_id, nova_amount, tx_hash, status }
}

// Example: customer spent $50 on campaign 7
const reward = await triggerReward({
  user_id: 42,
  campaign_id: 7,
  purchase_amount: 50.00,
});
```

---

## 6. Reward Tracking

```typescript
// Get all rewards issued by this merchant
async function getMerchantRewards(page = 1, limit = 20) {
  const res = await novaRequest(`/api/rewards?page=${page}&limit=${limit}`);
  return res.json(); // { data: RewardIssuance[], total, page, limit }
}

// Get rewards for a specific campaign
async function getCampaignRewards(campaignId: number) {
  const res = await novaRequest(`/api/campaigns/${campaignId}/rewards`);
  return res.json();
}
```

---

## 7. Error Handling

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Validation error — check `error.details` |
| `401` | Missing or invalid API key |
| `403` | Action not permitted for this merchant |
| `404` | Resource not found |
| `409` | Conflict (e.g., duplicate campaign name) |
| `422` | Business rule violation (e.g., expired campaign) |
| `429` | Rate limit exceeded — back off and retry |
| `500` | Internal server error — contact support |

Full error codes: [docs/error-codes.md](../error-codes.md)

---

## Postman Collection

A ready-to-import Postman collection is available at [`docs/api/postman/nova-rewards.postman_collection.json`](./postman/nova-rewards.postman_collection.json).

It includes pre-configured requests for all endpoints above, with environment variables for sandbox and production.
