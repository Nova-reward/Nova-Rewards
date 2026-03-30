# Nova Rewards — System Architecture

## Overview

Nova Rewards is a blockchain-powered loyalty platform built on the Stellar network. It consists of four primary layers: a Next.js frontend, a Node.js/Express backend API, Soroban smart contracts on Stellar, and a PostgreSQL + Redis data layer — all orchestrated via Docker and deployed on AWS.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │              Next.js Frontend  (port 3000)                   │  │
│   │                                                              │  │
│   │  Pages: login · register · dashboard · rewards · merchant   │  │
│   │         leaderboard · history · referral · settings         │  │
│   │                                                              │  │
│   │  Contexts: AuthContext · WalletContext · NotificationContext │  │
│   │                                                              │  │
│   │  Wallet: Freighter (browser extension) via freighter.js     │  │
│   └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP/REST + WebSocket (Socket.IO)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         GATEWAY LAYER                               │
│                                                                     │
│              Nginx Reverse Proxy  (port 8080)                       │
│              TLS termination · rate limiting · routing              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API LAYER                                  │
│                                                                     │
│              Node.js / Express Backend  (port 3001)                 │
│                                                                     │
│  Routes:                                                            │
│  /api/auth          /api/users         /api/campaigns               │
│  /api/rewards       /api/redemptions   /api/transactions            │
│  /api/trustline     /api/merchants     /api/leaderboard             │
│  /api/drops         /api/search        /api/webhooks                │
│  /api/contract-events                 /api/admin                    │
│  /api/health        /metrics (Prometheus)                           │
│                                                                     │
│  Middleware: JWT auth · rate limiter · DTO validation · metrics     │
│                                                                     │
│  Background Jobs:                                                   │
│  leaderboardCacheWarmer · dailyLoginBonus · webhookRetry            │
│                                                                     │
│  Services:                                                          │
│  emailService · webhookService · contractEventService               │
│  searchService · referralService · dropService · socketService      │
└──────┬──────────────────────────────────────────┬───────────────────┘
       │                                          │
       ▼                                          ▼
┌──────────────────────┐              ┌───────────────────────────────┐
│     DATA LAYER       │              │       BLOCKCHAIN LAYER        │
│                      │              │                               │
│  PostgreSQL (5432)   │              │  Stellar Horizon API          │
│  ─────────────────   │              │  (testnet / mainnet)          │
│  merchants           │              │                               │
│  users               │              │  Soroban Smart Contracts:     │
│  campaigns           │              │  ┌─────────────────────────┐  │
│  transactions        │              │  │ nova-rewards            │  │
│  point_transactions  │              │  │  · point balances       │  │
│  redemptions         │              │  │  · XLM swap via DEX     │  │
│  contract_events     │              │  └─────────────────────────┘  │
│  drops               │              │  ┌─────────────────────────┐  │
│  webhooks            │              │  │ nova_token (SEP-41)     │  │
│  email_logs          │              │  │  · mint / burn / xfer   │  │
│  search_analytics    │              │  └─────────────────────────┘  │
│                      │              │  ┌─────────────────────────┐  │
│  Redis (6379)        │              │  │ reward_pool             │  │
│  ─────────────────   │              │  │  · daily withdraw limit │  │
│  leaderboard cache   │              │  └─────────────────────────┘  │
│  session tokens      │              │  ┌─────────────────────────┐  │
│  rate limit counters │              │  │ vesting                 │  │
│                      │              │  │  · schedule management  │  │
└──────────────────────┘              │  └─────────────────────────┘  │
                                      │  ┌─────────────────────────┐  │
                                      │  │ referral                │  │
                                      │  │  · referrer tracking    │  │
                                      │  └─────────────────────────┘  │
                                      │  ┌─────────────────────────┐  │
                                      │  │ admin_roles             │  │
                                      │  │  · multisig admin ctrl  │  │
                                      │  └─────────────────────────┘  │
                                      └───────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. User Registration & Authentication

```
User                Frontend              Backend               PostgreSQL
 │                     │                     │                      │
 │── fill form ───────►│                     │                      │
 │                     │── POST /api/auth ──►│                      │
 │                     │     /register       │── INSERT users ─────►│
 │                     │                     │◄─ user row ──────────│
 │                     │                     │── sign JWT ──────────│
 │                     │◄── {accessToken,    │                      │
 │                     │     refreshToken}   │                      │
 │◄── store tokens ────│                     │                      │
 │    redirect /dash   │                     │                      │
```

### 2. Reward Issuance (Merchant → User)

```
Merchant UI          Backend              PostgreSQL          Stellar / Soroban
    │                   │                     │                      │
    │── POST /api/      │                     │                      │
    │   rewards/issue ─►│                     │                      │
    │                   │── verify merchant ─►│                      │
    │                   │── INSERT            │                      │
    │                   │   point_transactions►│                      │
    │                   │── UPDATE            │                      │
    │                   │   user balance ────►│                      │
    │                   │── invoke contract ──────────────────────►  │
    │                   │   nova-rewards                             │
    │                   │   .issue_reward()                          │
    │                   │◄─ tx hash ─────────────────────────────── │
    │                   │── INSERT                                   │
    │                   │   contract_events ─►│                      │
    │◄── 200 OK ────────│                     │                      │
```

### 3. Token Redemption

```
User UI              Backend              PostgreSQL          Stellar / Soroban
  │                     │                     │                      │
  │── POST /api/        │                     │                      │
  │   redemptions ─────►│                     │                      │
  │                     │── check balance ───►│                      │
  │                     │── verify trustline ──────────────────────► │
  │                     │◄─ trustline status ──────────────────────  │
  │                     │── deduct points ───►│                      │
  │                     │── INSERT redemption►│                      │
  │                     │── emit event ───────────────────────────►  │
  │                     │   (redemptionEventListener)                │
  │                     │── send email ───────────────────────────── │
  │◄── 200 OK ──────────│                     │                      │
```

### 4. Stellar Drop (Token Airdrop)

```
User UI              Frontend             Backend              Stellar Horizon
  │                     │                    │                      │
  │── click "Drop" ────►│                    │                      │
  │                     │── GET /api/drops ─►│                      │
  │                     │◄── drop details ───│                      │
  │                     │── Freighter signs  │                      │
  │                     │   XDR envelope     │                      │
  │                     │── POST /api/drops  │                      │
  │                     │   /claim ─────────►│                      │
  │                     │                    │── submit tx ────────►│
  │                     │                    │◄─ tx result ─────────│
  │                     │                    │── INSERT drop record  │
  │◄── success toast ───│◄── 200 OK ─────────│                      │
```

### 5. Real-Time Leaderboard Update

```
Backend Job              Redis                 Socket.IO            User Browser
     │                     │                       │                     │
     │ (cron: every 5min)  │                       │                     │
     │── query top users ──│                       │                     │
     │   from PostgreSQL   │                       │                     │
     │── SET leaderboard ─►│                       │                     │
     │── emit 'leaderboard │                       │                     │
     │   :update' ─────────────────────────────►   │                     │
     │                     │                       │── push to clients ─►│
     │                     │                       │                     │
```

---

## Component Interactions

### Frontend ↔ Backend

| Frontend Component | API Endpoint | Purpose |
|---|---|---|
| `AuthContext` | `POST /api/auth/login` | JWT issuance |
| `WalletContext` | `POST /api/trustline/verify` | Trustline check |
| `CampaignManager` | `GET/POST /api/campaigns` | Campaign CRUD |
| `RewardsHistory` | `GET /api/transactions` | Transaction list |
| `RedemptionCatalogue` | `GET /api/redemptions` | Available rewards |
| `Leaderboard` | `GET /api/leaderboard` | Cached rankings |
| `StellarDropModal` | `POST /api/drops/claim` | Airdrop claim |
| `ReferralLink` | `GET /api/users/referral` | Referral code |
| `NotificationCenter` | Socket.IO events | Real-time alerts |

### Backend ↔ Database

| Repository | Table | Operations |
|---|---|---|
| `userRepository` | `users` | CRUD, balance update |
| `campaignRepository` | `campaigns` | CRUD, status filter |
| `transactionRepository` | `transactions` | Insert, paginated fetch |
| `pointTransactionRepository` | `point_transactions` | Insert, user history |
| `redemptionRepository` | `redemptions` | Insert, status update |
| `contractEventRepository` | `contract_events` | Insert, event query |
| `leaderboardRepository` | `users` | Ranked balance query |
| `webhookRepository` | `webhooks` | CRUD, retry queue |
| `dropRepository` | `drops` | Insert, claim check |

### Backend ↔ Stellar

| Service / Route | Stellar Interaction | Contract |
|---|---|---|
| `stellarService.getNOVABalance()` | Horizon account query | — |
| `trustline` route | Horizon account balances | — |
| `rewards` route | Soroban invoke | `nova-rewards` |
| `drops` route | Horizon tx submit | — |
| `contractEventService` | Soroban event stream | all contracts |
| `blockchain/issueAsset.js` | Horizon payment op | — |
| `blockchain/sendRewards.js` | Horizon payment op | — |

### Smart Contract Interactions

```
admin_roles ──controls──► nova-rewards
                               │
                               ├──uses──► nova_token  (mint/burn)
                               │
                               └──uses──► reward_pool (daily limits)

vesting ──────────────────────────────► nova_token  (scheduled release)

referral ─────────────────────────────► nova-rewards (bonus on referral)
```

---

## Infrastructure Overview

```
                        ┌─────────────────────────────┐
                        │         AWS Cloud           │
                        │                             │
                        │  ┌─────────────────────┐   │
                        │  │  CloudFront / ALB   │   │
                        │  └──────────┬──────────┘   │
                        │             │               │
                        │  ┌──────────▼──────────┐   │
                        │  │   Auto Scaling Group │   │
                        │  │   EC2 instances      │   │
                        │  │   (Docker containers)│   │
                        │  └──────────┬──────────┘   │
                        │             │               │
                        │  ┌──────────▼──────────┐   │
                        │  │   RDS PostgreSQL     │   │
                        │  │   (Multi-AZ)         │   │
                        │  └─────────────────────┘   │
                        │                             │
                        │  Secrets: AWS Secrets Mgr   │
                        │  Monitoring: CloudWatch      │
                        │             Prometheus/Loki  │
                        └─────────────────────────────┘
```

**Key infrastructure components:**
- ALB with HTTPS termination (ACM certificate via Certbot/Let's Encrypt)
- EC2 Auto Scaling Group behind the ALB
- RDS PostgreSQL with PgBouncer connection pooling
- Redis for caching and rate limiting
- Cloudflare CDN for static assets
- Prometheus + Grafana + Loki for observability
- HashiCorp Vault (or AWS Secrets Manager) for secret rotation
- GitHub Actions CI/CD for automated deployments

---

## Key Design Decisions

- **Dual-ledger balance**: Points are tracked both in PostgreSQL (`point_transactions` table with triggers) and on-chain (Soroban `nova-rewards` contract). PostgreSQL is the source of truth for the API; on-chain state is authoritative for token transfers.
- **Trustline requirement**: Users must establish a Stellar trustline for the NOVA asset before receiving token rewards. The backend verifies this before any distribution.
- **Redis caching**: The leaderboard is pre-computed and cached in Redis by a background job to avoid expensive ranked queries on every request.
- **Event-driven webhooks**: Merchants can register webhook endpoints. The `webhookService` delivers events with exponential-backoff retry via the `webhookRetry` background job.
- **JWT + refresh tokens**: Short-lived access tokens (stored in memory) with longer-lived refresh tokens enable secure, stateless authentication.
