# Nova Rewards API Reference

**Base URL:** `http://localhost:3001/api/v1` (dev) · `https://api.novarewards.io/api/v1` (prod)

**OpenAPI spec:** [`openapi.json`](./openapi.json) — import into Postman or view at `/api/v1/docs` when the server is running.

**Legacy compatibility:** unversioned `/api/*` routes still resolve to v1 for existing clients, but they now return `Deprecation`, `Sunset`, `X-API-Version`, and `X-API-Migration-Guide` headers. New clients should use `/api/v1/*`.

---

## Authentication

## API versioning

NovaRewards uses URL-based API versioning. The current version is `v1`.

| Route | Status | Notes |
|---|---|---|
| `/api/v1/*` | Current | Use this for all new integrations. |
| `/api/*` | Legacy alias for v1 | Backward compatible, deprecated, sunset target `2027-01-01`. |
| `/api/versions` | Discovery | Returns supported versions, current version, and migration policy. |

Versioned responses include `X-API-Version: v1`. Legacy unversioned responses also include `Deprecation: true`, `Sunset: 2027-01-01`, `X-API-Deprecated: true`, and `X-API-Migration-Guide: /api/versioning`.

Migration from the legacy path is mechanical: prefix existing `/api` URLs with `/api/v1`. For example, `POST /api/auth/login` becomes `POST /api/v1/auth/login`; request bodies, authentication headers, and response schemas are unchanged.

---

### JWT Bearer (user endpoints)

1. Call `POST /auth/login` with email + password.
2. Copy `accessToken` from the response.
3. Send `Authorization: Bearer <token>` on every protected request.
4. When the access token expires, call `POST /auth/refresh` with the `refreshToken`.

### Merchant API Key (merchant endpoints)

1. Register via `POST /merchants` — the plain-text key is returned **once**.
2. Send `x-api-key: <key>` on every merchant-scoped request.

### Auth quick-reference

| Endpoint group | Auth required |
|---|---|
| `POST /auth/*` | None (public) |
| `POST /users` | None (public) |
| `GET /users/:walletAddress/points` | None (public) |
| `GET /merchants/:id` | None (public) |
| `GET /users/:id`, `PATCH`, `DELETE` | Bearer JWT |
| `GET /redemptions`, `POST /redemptions` | Bearer JWT |
| `GET /leaderboard` | Bearer JWT |
| `GET /drops/*`, `POST /drops/:id/claim` | Bearer JWT |
| `GET /notifications`, `PATCH /notifications/:id/read` | Bearer JWT |
| `GET /wallet/balance` | Bearer JWT |
| `GET /admin/*` | Bearer JWT (admin role) |
| `POST /campaigns`, `GET /campaigns` | Merchant API key |
| `POST /rewards/issue`, `POST /rewards/distribute` | Merchant API key |
| `GET /transactions/merchant-totals` | Merchant API key |
| `GET /transactions/merchant/history` | Merchant API key |
| `POST /webhooks`, `GET /webhooks` | Merchant API key |

---

## Standard response envelope

Every response wraps data in a consistent shape:

```json
{ "success": true, "data": { ... } }
```

Errors:

```json
{ "success": false, "error": "validation_error", "message": "walletAddress is required" }
```

Common HTTP status codes:

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 202 | Accepted (async job queued) |
| 400 | Validation error |
| 401 | Missing / invalid token |
| 403 | Forbidden (wrong owner or role) |
| 404 | Resource not found |
| 409 | Conflict (duplicate, out-of-stock, etc.) |
| 502 | On-chain operation failed |

---

## Auth — `/auth`

### POST /auth/register

Register a new user account with email + password.

**Auth:** None

**Body:**
```json
{ "email": "alice@example.com", "password": "S3cur3P@ss!", "firstName": "Alice", "lastName": "Smith" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| email | string | ✓ | Valid email |
| password | string | ✓ | Min 8 chars, upper + lower + digit |
| firstName | string | ✓ | |
| lastName | string | ✓ | |

**201 Created:**
```json
{ "success": true, "data": { "id": 42, "email": "alice@example.com", "first_name": "Alice", "last_name": "Smith", "role": "user", "created_at": "2025-01-15T10:30:00Z" } }
```

**Errors:** `400` validation, `409` email already registered.

---

### POST /auth/login

Authenticate and obtain JWT access + refresh tokens.

**Auth:** None

**Body:**
```json
{ "email": "alice@example.com", "password": "S3cur3P@ss!" }
```

**200 OK:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": 42, "email": "alice@example.com", "firstName": "Alice", "lastName": "Smith", "role": "user" }
  }
}
```

**Errors:** `400` validation, `401` invalid credentials.

---

### POST /auth/refresh

Rotate refresh token and issue new access + refresh tokens (one-time use).

**Auth:** None

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

**200 OK:**
```json
{ "success": true, "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." } }
```

**Errors:** `401` invalid/expired/already-used token.

---

### POST /auth/logout

Revoke access token and refresh token (adds to blocklist).

**Auth:** Bearer JWT (optional — revokes whatever tokens are provided)

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

**200 OK:**
```json
{ "success": true, "message": "Logged out" }
```

---

### POST /auth/challenge

Request a Stellar wallet challenge nonce for wallet-based (SEP-10 style) authentication.

**Auth:** None

**Body:**
```json
{ "walletAddress": "GABC..." }
```

**200 OK:**
```json
{
  "success": true,
  "data": { "walletAddress": "GABC...", "nonce": "abc123", "timestamp": 1700000000, "domain": "novarewards.io", "expiresAt": "2025-01-15T10:35:00Z", "message": "Sign this message..." }
}
```

**Errors:** `400` invalid wallet address.

---

### POST /auth/verify-challenge

Submit a signed challenge to obtain JWT tokens.

**Auth:** None

**Body:**
```json
{ "walletAddress": "GABC...", "signedXDR": "<base64-xdr>" }
```

**200 OK:**
```json
{ "success": true, "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." } }
```

**Errors:** `400` invalid signature, `401` challenge expired.

---

## Users — `/users`

### POST /users

Create a new user (wallet-based registration).

**Auth:** None

**Body:**
```json
{ "walletAddress": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", "referralCode": "GAAZI4..." }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| walletAddress | string | ✓ | Valid Stellar public key |
| referralCode | string | | Referrer's wallet address |

**201 Created:**
```json
{ "success": true, "data": { "id": 42, "wallet_address": "GBBD...", "created_at": "2025-01-15T10:30:00Z" } }
```

**Errors:** `400` missing/invalid walletAddress, `409` wallet already registered.

---

### GET /users/:walletAddress/points

Get the off-chain point balance for a wallet address.

**Auth:** None

**Path:** `walletAddress` — Stellar public key

**200 OK:**
```json
{ "success": true, "data": { "walletAddress": "GBBD...", "balance": 1250.5 } }
```

**Errors:** `400` invalid wallet address.

---

### GET /users/:id/token-balance

Get the user's on-chain NOVA token balance from Horizon (cached 30 s).

**Auth:** None

**Path:** `id` — integer user ID

**200 OK:**
```json
{ "success": true, "data": { "userId": 42, "stellarPublicKey": "GBBD...", "tokenBalance": "150.0000000", "cached": false } }
```

**Errors:** `400` invalid id, `404` user not found or no linked Stellar key.

---

### GET /users/:id

Get user profile. Returns private profile for owner/admin, public profile otherwise.

**Auth:** Bearer JWT

**200 OK:**
```json
{ "success": true, "data": { "id": 42, "email": "alice@example.com", "first_name": "Alice", "last_name": "Smith", "bio": "Stellar enthusiast", "avatar_url": "/avatars/user-42.jpg", "role": "user" } }
```

**Errors:** `400` invalid id, `401` unauthenticated, `404` not found.

---

### PATCH /users/:id

Partial profile update. Owner or admin only.

**Auth:** Bearer JWT

**Body (all optional):**
```json
{ "firstName": "Alice", "lastName": "Smith", "bio": "Stellar enthusiast", "stellarPublicKey": "GBBD..." }
```

**200 OK:**
```json
{ "success": true, "data": { "id": 42, "first_name": "Alice", ... } }
```

**Errors:** `401` unauthenticated, `403` not owner/admin, `404` not found.

---

### DELETE /users/:id

Soft-delete and anonymise a user account. Owner or admin only.

**Auth:** Bearer JWT

**200 OK:**
```json
{ "success": true, "message": "User account deleted successfully" }
```

**Errors:** `401`, `403`, `404`.

---

### GET /users/:id/referrals

Get referral statistics for a user.

**Auth:** None

**200 OK:**
```json
{ "success": true, "data": { "total_referrals": 5, "total_bonus_earned": 250 } }
```

**Errors:** `400` invalid id, `404` not found.

---

### POST /users/:id/referrals/process

Manually trigger a referral bonus for a referred user.

**Auth:** None

**Body:**
```json
{ "referredUserId": 99 }
```

**200 OK:**
```json
{ "success": true, "data": { "bonus": 50 }, "message": "Referral bonus applied" }
```

**Errors:** `400` validation or referral already processed.

---

### POST /users/:id/profile-picture

Upload avatar image (JPEG/PNG/WebP, max 5 MB). Owner or admin only.

**Auth:** Bearer JWT

**Content-Type:** `multipart/form-data`

**Form field:** `avatar` — image file

**200 OK:**
```json
{ "success": true, "data": { "avatarUrl": "/avatars/user-42-1700000000.jpg" } }
```

**Errors:** `400` no file / wrong type / too large, `403` not owner/admin.

---

### PATCH /users/:id/password

Change password. Requires current password verification. Owner only.

**Auth:** Bearer JWT

**Body:**
```json
{ "currentPassword": "OldP@ss1", "newPassword": "NewP@ss1" }
```

**200 OK:**
```json
{ "success": true, "message": "Password updated successfully" }
```

**Errors:** `400` validation, `401` wrong current password, `403` not owner, `404` not found.

---

### GET /users/:id/balance

Get combined on-chain NOVA balance and off-chain points. Owner or admin only. Cached 30 s.

**Auth:** Bearer JWT

**200 OK:**
```json
{ "success": true, "data": { "userId": 42, "stellarPublicKey": "GBBD...", "onChainBalance": "150.0000000", "offChainPoints": 1250.5 }, "cached": false }
```

**Errors:** `400`, `401`, `403`, `404`.

---

### GET /users/:id/rewards/history

Cursor-paginated reward history. Owner or admin only.

**Auth:** Bearer JWT

**Query params:**

| Param | Type | Default | Notes |
|---|---|---|---|
| limit | integer | 20 | 1–100 |
| cursor | string | | Opaque cursor from previous response |

**200 OK:**
```json
{ "success": true, "data": [...], "pagination": { "nextCursor": "abc123", "limit": 20 } }
```

**Errors:** `400`, `401`, `403`, `404`.

---

## Merchants — `/merchants`

### POST /merchants  ·  POST /merchants/register

Register a new merchant. `/merchants/register` is an alias.

**Auth:** None

**Body:**
```json
{ "name": "Stellar Coffee Co.", "walletAddress": "GAAZI4...", "businessCategory": "Food & Beverage" }
```

| Field | Type | Required |
|---|---|---|
| name | string | ✓ |
| walletAddress | string | ✓ |
| businessCategory | string | |

**201 Created** — API key returned **once**, store it securely:
```json
{ "success": true, "data": { "id": 7, "name": "Stellar Coffee Co.", "wallet_address": "GAAZI4...", "api_key": "abc123plaintext" } }
```

**Errors:** `400` validation, `409` wallet already registered.

---

### GET /merchants/:id

Get merchant profile and active campaigns.

**Auth:** None

**200 OK:**
```json
{ "success": true, "data": { "id": 7, "name": "Stellar Coffee Co.", "wallet_address": "GAAZI4...", "business_category": "Food & Beverage", "created_at": "2025-02-01T08:00:00Z" } }
```

**Errors:** `400` invalid id, `404` not found.

---

### PATCH /merchants/:id

Update merchant profile. Merchant can only update their own record.

**Auth:** Merchant API key

**Body (all optional):**
```json
{ "name": "New Name", "businessCategory": "Retail" }
```

**200 OK:**
```json
{ "success": true, "data": { "id": 7, "name": "New Name", ... } }
```

**Errors:** `400` empty body / validation, `403` not own record, `404` not found.

---

## Campaigns — `/campaigns`

### POST /campaigns

Create a campaign in the database and register it on-chain via Soroban.

**Auth:** Merchant API key

**Body:**
```json
{ "name": "Summer Loyalty Drive", "rewardRate": 1.5, "startDate": "2025-06-01", "endDate": "2025-08-31" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| name | string | ✓ | |
| rewardRate | number | ✓ | Tokens per qualifying action |
| startDate | string | ✓ | ISO date |
| endDate | string | ✓ | ISO date, must be after startDate |

**201 Created:**
```json
{ "success": true, "data": { "id": 3, "merchant_id": 7, "name": "Summer Loyalty Drive", "reward_rate": 1.5, "start_date": "2025-06-01", "end_date": "2025-08-31", "on_chain_status": "confirmed", "tx_hash": "a1b2..." } }
```

**Errors:** `400` validation, `502` on-chain registration failed.

---

### GET /campaigns

List all campaigns for the authenticated merchant (cached 60 s).

**Auth:** Merchant API key

**200 OK:**
```json
{ "success": true, "data": [...], "cached": false }
```

---

### GET /campaigns/:id

Get a single campaign by ID. Merchant can only read their own campaigns.

**Auth:** Merchant API key

**200 OK:**
```json
{ "success": true, "data": { "id": 3, "name": "Summer Loyalty Drive", ... } }
```

**Errors:** `400`, `403`, `404`.

---

### PATCH /campaigns/:id

Update mutable campaign fields and push the change on-chain.

**Auth:** Merchant API key

**Body (at least one required):**
```json
{ "name": "Updated Name", "rewardRate": 2.0 }
```

**200 OK:**
```json
{ "success": true, "data": { "id": 3, "name": "Updated Name", "reward_rate": 2.0, ... } }
```

**Errors:** `400` validation, `403` not own campaign, `404` not found, `409` not yet confirmed on-chain, `502` chain error.

---

### DELETE /campaigns/:id

Pause the campaign on-chain then soft-delete in the database.

**Auth:** Merchant API key

**200 OK:**
```json
{ "success": true, "data": { "id": 3, "deleted": true } }
```

**Errors:** `403`, `404`, `409` not confirmed on-chain, `502` chain error.

---

## Rewards — `/rewards`

### POST /rewards/issue

Enqueue an idempotent reward issuance job.

**Auth:** Merchant API key

**Body:**
```json
{ "idempotencyKey": "order-9981", "walletAddress": "GBBD...", "amount": 50, "campaignId": 3, "userId": 42 }
```

| Field | Type | Required |
|---|---|---|
| idempotencyKey | string | ✓ |
| walletAddress | string | ✓ |
| amount | number | ✓ |
| campaignId | integer | ✓ |
| userId | integer | |

**202 Accepted** (new job):
```json
{ "success": true, "queued": true, "issuanceId": "uuid" }
```

**200 OK** (duplicate — already processed):
```json
{ "success": true, "duplicate": true, "issuanceId": "uuid", "status": "completed" }
```

**Errors:** `400` validation.

---

### POST /rewards/distribute

Distribute NOVA tokens directly to a customer wallet on-chain.

**Auth:** Merchant API key

**Body:**
```json
{ "walletAddress": "GBBD...", "amount": 50, "campaignId": 3 }
```

**200 OK:**
```json
{ "success": true, "txHash": "a1b2c3d4...", "transaction": { ... } }
```

**Errors:** `400` no trustline / validation, `403` campaign not owned by merchant, `404` campaign not found, `502` chain error.

---

## Redemptions — `/redemptions`

### POST /redemptions

Redeem a reward. Idempotent via `X-Idempotency-Key` header.

**Auth:** Bearer JWT

**Headers:** `X-Idempotency-Key: <uuid>` (required)

**Body:**
```json
{ "userId": 42, "rewardId": 12, "campaignId": 3 }
```

| Field | Type | Required |
|---|---|---|
| userId | integer | ✓ |
| rewardId | integer | ✓ |
| campaignId | integer | |

**201 Created** (new redemption):
```json
{ "success": true, "data": { "redemption": { "id": 55, "user_id": 42, "reward_id": 12, "points_spent": 100, "created_at": "..." }, "pointTx": { ... } } }
```

**200 OK** (idempotent replay):
```json
{ "success": true, "data": { ... }, "idempotent": true }
```

**Errors:** `400` missing idempotency key / validation, `403` redeeming for another user, `404` reward not found, `409` out of stock / insufficient points / reward inactive.

---

### GET /redemptions

List redemption history for the authenticated user.

**Auth:** Bearer JWT

**Query params:**

| Param | Type | Default |
|---|---|---|
| page | integer | 1 |
| limit | integer | 20 (max 100) |

**200 OK:**
```json
{ "success": true, "data": [...], "total": 42, "page": 1, "limit": 20 }
```

---

### GET /redemptions/:id

Get a single redemption by ID. User can only access their own redemptions.

**Auth:** Bearer JWT

**200 OK:**
```json
{ "success": true, "data": { "id": 55, "user_id": 42, "reward_id": 12, "points_spent": 100, "created_at": "..." } }
```

**Errors:** `400` invalid id, `401`, `404`.

---

## Transactions — `/transactions`

### POST /transactions/record

Verify a Stellar transaction on Horizon and store the canonical record.

**Auth:** None

**Body:**
```json
{ "txHash": "a1b2...", "txType": "distribution", "amount": 50, "fromWallet": "GAAZI4...", "toWallet": "GBBD...", "merchantId": 7, "campaignId": 3 }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| txHash | string | ✓ | Stellar transaction hash |
| txType | string | ✓ | `distribution`, `redemption`, or `transfer` |
| amount | number | | |
| fromWallet | string | | Valid Stellar public key |
| toWallet | string | | Valid Stellar public key |
| merchantId | integer | | |
| campaignId | integer | | |

**201 Created:**
```json
{ "success": true, "data": { "id": 101, "tx_hash": "a1b2...", "tx_type": "distribution", "amount": 50, "stellar_ledger": 48293847, ... } }
```

**Errors:** `400` invalid hash / type / wallet, `409` duplicate transaction.

---

### GET /transactions/merchant-totals

Aggregate totals (volume, count) for the authenticated merchant.

**Auth:** Merchant API key

**200 OK:**
```json
{ "success": true, "data": { "total_distributed": 5000, "total_redeemed": 1200, "transaction_count": 340 } }
```

---

### GET /transactions/merchant/history

Paginated transaction history for the authenticated merchant.

**Auth:** Merchant API key

**Query params:** `page`, `limit`, `txType`, `startDate`, `endDate`

**200 OK:**
```json
{ "success": true, "data": [...], "total": 340, "page": 1, "limit": 20 }
```

---

### GET /transactions/report

Generate a transaction report for the authenticated merchant.

**Auth:** Merchant API key

**Query params:** `startDate`, `endDate`, `format` (`json` | `csv`)

**200 OK:**
```json
{ "success": true, "data": { "period": { "from": "2025-01-01", "to": "2025-01-31" }, "summary": { ... }, "rows": [...] } }
```

---

### POST /transactions/refund

Refund a transaction for the authenticated merchant.

**Auth:** Merchant API key

**Body:**
```json
{ "transactionId": 101, "reason": "Customer request" }
```

**201 Created:**
```json
{ "success": true, "data": { "refundId": 202, "originalTxId": 101, ... } }
```

---

### POST /transactions/reconcile

Reconcile merchant transactions against Horizon records.

**Auth:** Merchant API key

**Body:** `{}` (optional date range filters)

**200 OK:**
```json
{ "success": true, "data": { "matched": 320, "unmatched": 5, "discrepancies": [...] } }
```

---

### GET /transactions/user/history

Paginated transaction history (all users, admin use).

**Auth:** None

**Query params:** `page`, `limit`, `walletAddress`

**200 OK:**
```json
{ "success": true, "data": [...], "total": 1000, "page": 1, "limit": 20 }
```

---

### GET /transactions/:walletAddress

Get NOVA payment history for a wallet from Horizon (falls back to DB if Horizon is unavailable).

**Auth:** None

**200 OK:**
```json
{ "success": true, "data": [...], "source": "horizon" }
```

**Errors:** `400` invalid wallet address.

---

## Trustline — `/trustline`

### POST /trustline/verify

Check whether a wallet has an active NOVA trustline.

**Auth:** None

**Body:**
```json
{ "walletAddress": "GBBD..." }
```

**200 OK:**
```json
{ "success": true, "data": { "exists": true } }
```

**Errors:** `400` invalid wallet address.

---

### POST /trustline/build-xdr

Build an unsigned `changeTrust` XDR for the user to sign with Freighter.

**Auth:** None

**Body:**
```json
{ "walletAddress": "GBBD..." }
```

**200 OK:**
```json
{ "success": true, "data": { "xdr": "AAAAAQ...", "networkPassphrase": "Test SDF Network ; September 2015" } }
```

**Errors:** `400` invalid wallet address.

---

## Wallet — `/wallet`

### GET /wallet/supported

List supported wallet types.

**Auth:** None

**200 OK:**
```json
{ "success": true, "wallets": [{ "id": "freighter", "name": "Freighter", "downloadUrl": "https://freighter.app" }] }
```

---

### POST /wallet/verify

Verify a wallet connection and return wallet info.

**Auth:** None

**Body:**
```json
{ "publicKey": "GBBD...", "walletType": "freighter" }
```

**200 OK:**
```json
{ "success": true, "publicKey": "GBBD...", "network": "testnet", "isValid": true }
```

**Errors:** `400` missing publicKey or invalid wallet.

---

### GET /wallet/balance

Get the authenticated user's live NOVA token balance from Stellar.

**Auth:** Bearer JWT

**200 OK:**
```json
{ "success": true, "data": { "balance": "150.0000000", "asset": "NOVA", "publicKey": "GBBD..." } }
```

**Errors:** `400` no wallet linked, `401`.

---

## Leaderboard — `/leaderboard`

### GET /leaderboard

Get top users ranked by earned points.

**Auth:** Bearer JWT

**Query params:**

| Param | Type | Default | Notes |
|---|---|---|---|
| period | string | `weekly` | `weekly` or `alltime` |
| limit | integer | 50 | max 100 |

**200 OK:**
```json
{
  "success": true,
  "data": {
    "period": "weekly",
    "rankings": [{ "rank": 1, "user_id": 42, "display_name": "Alice", "points": 5000 }],
    "currentUser": { "rank": 12, "points": 1250 }
  }
}
```

**Errors:** `401`.

---

## Drops — `/drops`

### GET /drops/eligible

List active drops the authenticated user qualifies for.

**Auth:** Bearer JWT

**200 OK:**
```json
{ "success": true, "data": [{ "id": 1, "name": "Genesis Drop", "amount": 100, "ends_at": "2025-12-31T23:59:59Z" }] }
```

**Errors:** `401`.

---

### POST /drops/:id/claim

Claim a drop for the authenticated user.

**Auth:** Bearer JWT

**Path:** `id` — drop ID

**201 Created:**
```json
{ "success": true, "data": { "claimId": 88, "dropId": 1, "amount": 100, "txHash": "a1b2..." } }
```

**Errors:** `400` already claimed / not eligible, `401`, `404` drop not found.

---

## Notifications — `/notifications`

### GET /notifications

Paginated in-app notifications for the authenticated user.

**Auth:** Bearer JWT

**Query params:** `page` (default 1), `limit` (default 20, max 100)

**200 OK:**
```json
{ "success": true, "data": [{ "id": 10, "type": "reward_issued", "message": "You earned 50 NOVA!", "read": false, "created_at": "..." }], "total": 5, "page": 1, "limit": 20 }
```

---

### PATCH /notifications/:id/read

Mark a single notification as read.

**Auth:** Bearer JWT

**200 OK:**
```json
{ "success": true, "data": { "id": 10, "read": true } }
```

**Errors:** `400` invalid id, `401`, `404`.

---

## Webhooks — `/webhooks`

All webhook endpoints require **Merchant API key** authentication.

### POST /webhooks

Register a new webhook endpoint.

**Body:**
```json
{ "url": "https://myapp.com/hooks/nova", "events": ["reward.issued", "redemption.created"], "isActive": true }
```

**201 Created:**
```json
{ "success": true, "data": { "id": 5, "url": "https://myapp.com/hooks/nova", "secret": "whsec_...", "events": [...], "isActive": true } }
```

---

### GET /webhooks

List all webhooks for the authenticated merchant.

**200 OK:**
```json
{ "success": true, "data": [{ "id": 5, "url": "https://myapp.com/hooks/nova", "events": [...], "isActive": true }] }
```

---

### PATCH /webhooks/:id

Update a webhook's URL, events, or active status.

**Body (all optional):**
```json
{ "url": "https://myapp.com/hooks/nova-v2", "events": ["reward.issued"], "isActive": false }
```

**200 OK:**
```json
{ "success": true, "data": { "id": 5, ... } }
```

**Errors:** `403` not own webhook, `404`.

---

### DELETE /webhooks/:id

Remove a webhook.

**200 OK:**
```json
{ "success": true, "data": { "id": 5, "deleted": true } }
```

---

### GET /webhooks/:id/deliveries

Paginated delivery log for a webhook.

**Query params:** `page`, `limit`

**200 OK:**
```json
{ "success": true, "data": [{ "id": 200, "event": "reward.issued", "status": "success", "responseCode": 200, "attemptedAt": "..." }] }
```

---

### POST /webhooks/:id/test

Send a test event to the webhook URL.

**200 OK:**
```json
{ "success": true, "data": { "delivered": true, "responseCode": 200 } }
```

---

### GET /webhooks/events

List all supported webhook event types.

**200 OK:**
```json
{ "success": true, "data": ["reward.issued", "redemption.created", "campaign.created", "campaign.updated", "drop.claimed"] }
```

---

### POST /webhooks/actions

Receive an inbound webhook from a merchant system. Requires `x-signature` or `x-hub-signature-256` header (HMAC-SHA256).

**Headers:** `x-signature: sha256=<hmac>`

**200 OK:**
```json
{ "success": true }
```

**Errors:** `401` missing/invalid signature.

---

## Search — `/search`

### GET /search

Full-text search across rewards, campaigns, and users.

**Auth:** Bearer JWT

**Query params:**

| Param | Type | Required | Notes |
|---|---|---|---|
| q | string | ✓ | Search query |
| type | string | | `rewards`, `campaigns`, `users`, or `all` (default) |
| is_active | boolean | | Filter by active status |
| merchant_id | integer | | Filter by merchant |
| page | integer | | Default 1 |
| limit | integer | | Default 20, max 50 |

**200 OK:**
```json
{ "success": true, "data": { "results": [...], "total": 42, "facets": { "type": { "rewards": 10, "campaigns": 32 } } } }
```

---

### GET /search/suggest

Autocomplete suggestions for a partial query.

**Auth:** Bearer JWT

**Query params:** `q` (required), `limit` (default 5)

**200 OK:**
```json
{ "success": true, "data": ["summer loyalty", "summer sale", "summer drop"] }
```

---

### POST /search/click

Record a click-through event for search analytics.

**Auth:** Bearer JWT

**Body:**
```json
{ "query": "summer loyalty", "resultId": 3, "resultType": "campaign" }
```

**200 OK:**
```json
{ "success": true }
```

---

### GET /search/analytics/top-queries

Top search queries. Admin only.

**Auth:** Bearer JWT (admin)

**Query params:** `limit` (default 10), `period` (`day`, `week`, `month`)

**200 OK:**
```json
{ "success": true, "data": [{ "query": "summer loyalty", "count": 142 }] }
```

---

### GET /search/analytics/stats

Aggregate search statistics. Admin only.

**Auth:** Bearer JWT (admin)

**200 OK:**
```json
{ "success": true, "data": { "totalSearches": 5000, "uniqueQueries": 1200, "avgResultsPerQuery": 8.3 } }
```

---

### POST /search/reindex

Trigger a bulk reindex of all searchable entities. Admin only.

**Auth:** Bearer JWT (admin)

**202 Accepted:**
```json
{ "success": true, "message": "Reindex job queued" }
```

---

## Admin — `/admin`

All admin endpoints require **Bearer JWT with admin role**.

### GET /admin/stats

Aggregate platform statistics.

**200 OK:**
```json
{ "success": true, "data": { "totalUsers": 15000, "totalMerchants": 120, "totalTransactions": 85000, "totalNovaDistributed": 4200000 } }
```

---

### GET /admin/users

Paginated user list, searchable by email or name.

**Query params:** `search`, `page` (default 1), `limit` (default 20, max 100)

**200 OK:**
```json
{ "success": true, "data": { "users": [...], "total": 15000, "page": 1, "limit": 20 } }
```

---

### GET /admin/rewards

List all platform rewards.

**200 OK:**
```json
{ "success": true, "data": [{ "id": 1, "name": "Free Coffee", "points_cost": 100, "stock": 500, "is_active": true }] }
```

---

### POST /admin/rewards

Create a new reward.

**Body:**
```json
{ "name": "Free Coffee", "pointsCost": 100, "stock": 500, "description": "One free coffee at any partner café" }
```

**201 Created:**
```json
{ "success": true, "data": { "id": 1, "name": "Free Coffee", ... } }
```

---

### PATCH /admin/rewards/:id

Update a reward.

**Body (all optional):**
```json
{ "name": "Free Latte", "pointsCost": 120, "stock": 400, "isActive": true }
```

**200 OK:**
```json
{ "success": true, "data": { "id": 1, ... } }
```

---

### DELETE /admin/rewards/:id

Delete a reward.

**200 OK:**
```json
{ "success": true, "data": { "id": 1, "deleted": true } }
```

---

### DELETE /admin/campaigns/:id

Force-delete a campaign (admin override).

**200 OK:**
```json
{ "success": true, "data": { "id": 3, "deleted": true } }
```

---

### GET /admin/audit-logs

Paginated audit log.

**Query params:** `page`, `limit`, `entityType`, `action`, `startDate`, `endDate`

**200 OK:**
```json
{ "success": true, "data": [{ "id": 500, "entity_type": "user", "action": "login", "performed_by": 42, "created_at": "..." }] }
```

---

### GET /admin/backups

List available database backups.

**200 OK:**
```json
{ "success": true, "data": [{ "filename": "backup-2025-01-15.sql.gz", "size": 52428800, "createdAt": "..." }] }
```

---

### POST /admin/backups/run

Trigger an immediate backup cycle.

**202 Accepted:**
```json
{ "success": true, "message": "Backup job started" }
```

---

### GET /admin/feature-flags

List all feature flags.

**200 OK:**
```json
{ "success": true, "data": [{ "key": "new_dashboard", "enabled": true, "description": "Enable new dashboard UI" }] }
```

---

### PATCH /admin/feature-flags/:key

Toggle or update a feature flag.

**Body:**
```json
{ "enabled": false }
```

**200 OK:**
```json
{ "success": true, "data": { "key": "new_dashboard", "enabled": false } }
```

---

### POST /admin/unblock-ip

Remove an IP address from the abuse blocklist.

**Body:**
```json
{ "ip": "203.0.113.42" }
```

**200 OK:**
```json
{ "success": true, "message": "IP unblocked" }
```

---

## Health — `/health`

### GET /health

Basic liveness check.

**Auth:** None

**200 OK:**
```json
{ "success": true, "data": { "status": "ok" } }
```

---

### GET /health/detailed

Comprehensive health check (database, Redis, Stellar, disk, memory).

**Auth:** None

**200 OK** (healthy or degraded) / **503** (unhealthy):
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-01-15T10:30:00Z",
    "responseTime": "45ms",
    "uptime": "3600.50s",
    "environment": "production",
    "checks": {
      "database": { "status": "healthy", "latency": "12ms" },
      "cache": { "status": "healthy", "latency": "2ms" },
      "stellar": { "status": "healthy" }
    }
  }
}
```

---

### GET /health/ready

Readiness check — returns 200 only when DB and cache are reachable.

**Auth:** None

**200 OK:**
```json
{ "success": true, "data": { "status": "ready", "database": "healthy", "cache": "healthy" } }
```

**503:**
```json
{ "success": false, "data": { "status": "not_ready", "database": "unhealthy", "cache": "healthy" } }
```

---

## Error codes reference

| Code | Description |
|---|---|
| `validation_error` | Request body or params failed validation |
| `invalid_credentials` | Wrong email or password |
| `unauthorized` | Missing or invalid token |
| `forbidden` | Authenticated but not permitted |
| `not_found` | Resource does not exist |
| `duplicate_email` | Email already registered |
| `duplicate_user` | Wallet already registered |
| `duplicate_merchant` | Merchant wallet already registered |
| `duplicate_transaction` | Transaction hash already recorded |
| `no_trustline` | Recipient has no NOVA trustline |
| `out_of_stock` | Reward stock exhausted |
| `insufficient_points` | User does not have enough points |
| `reward_inactive` | Reward is not currently active |
| `invalid_campaign` | Campaign is expired or inactive |
| `chain_not_ready` | Campaign not yet confirmed on-chain |
| `chain_error` | On-chain operation failed |
| `referral_error` | Referral bonus could not be applied |
| `internal_error` | Unexpected server error |
